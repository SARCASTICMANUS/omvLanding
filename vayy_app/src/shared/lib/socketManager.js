import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { getWsUrl } from "./wsUrl";
import {
  STORAGE_KEYS,
  WS_MAX_RECONNECT,
  WS_OUTBOX_MAX,
  WS_OUTBOX_TTL_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_JITTER,
  WS_RECONNECT_MAX_MS,
  WS_IDLE_TTL_MS,
} from "../../constants";

const LOG_TAG = "[SocketManager]";

let _idCounter = 0;

class SocketManager {
  constructor() {
    this.connections = new Map();
    this.keepAlivePaths = new Set();
    this.idleTimers = new Map();
    this.pendingIdle = new Set();
    this.outboxes = new Map();
    this._appStateSubscription = null;
    this._startAppStateListener();
  }

  /**
   * Sockets are only reconnected from the app-state listener when there is
   * someone to receive the events: AppState is a singleton subscription, but
   * the per-channel bookkeeping stays in `connections`.
   */
  _startAppStateListener() {
    if (this._appStateSubscription) return;
    this._appStateSubscription = AppState.addEventListener(
      "change",
      (state) => this._handleAppStateChange(state)
    );
  }

  _handleAppStateChange(state) {
    if (state !== "active") {
      this._reapPendingIdle();
      return;
    }
    // A close that happened while the app was backgrounded deliberately did not
    // schedule a retry (JS timers are unreliable in the background). Re-open
    // every channel that still has subscribers, and give a "failed" channel a
    // fresh budget of attempts.
    for (const [path, entry] of this.connections) {
      if (entry.subscribers.size === 0) continue;
      if (entry.state === "connected" || entry.state === "connecting") continue;
      if (entry.terminated) continue;
      entry.reconnectAttempts = 0;
      console.log(
        `${LOG_TAG} APP_FOREGROUND path=${path} state=${entry.state} reconnecting`
      );
      this._connect(path);
    }
  }

  /**
   * Closes every channel that lost its last subscriber while the app was in the
   * foreground.
   *
   * This used to be a self-re-arming WS_IDLE_TTL_MS poll, so a channel that was
   * abandoned (a trip that ended, a logout, a screen unmount) was never reaped
   * for as long as the app stayed open, and it logged one line every five
   * minutes forever. Those channels stacked up — one stale log line per hour
   * per leaked socket. Backgrounding is the reliable signal that nothing is
   * watching any more, so the teardown waits for that event instead of polling.
   */
  _reapPendingIdle() {
    if (this.pendingIdle.size === 0) return;
    for (const path of [...this.pendingIdle]) {
      const entry = this.connections.get(path);
      if (entry && entry.subscribers.size > 0) continue;
      if (this.keepAlivePaths.has(path)) continue;
      console.log(`${LOG_TAG} idle REAP path=${path}`);
      this.disconnect(path);
    }
    this.pendingIdle.clear();
  }

  keepAlive(path) {
    if (!path) return;
    this.keepAlivePaths.add(path);
    const entry = this.connections.get(path);
    console.log(`${LOG_TAG} keepAlive path=${path} exists=${!!entry} state=${entry?.state} subs=${entry?.subscribers.size}`);
    if (entry) entry.terminated = false;
    if (entry && entry.state === "disconnected" && entry.subscribers.size > 0) {
      this._connect(path);
    }
  }

  releaseKeepAlive(path) {
    if (!path) return;
    this.keepAlivePaths.delete(path);
    const entry = this.connections.get(path);
    if (entry && entry.subscribers.size === 0) {
      this._startIdleTimer(path);
    }
  }

  subscribe(path, { onMessage, onStateChange } = {}) {
    if (!path) return () => {};

    const id = ++_idCounter;
    const isNew = !this.connections.has(path);

    if (isNew) {
      this.connections.set(path, {
        socket: null,
        state: "disconnected",
        subscribers: new Map(),
        reconnectAttempts: 0,
        reconnectTimer: null,
        _connecting: false,
        terminated: false,
      });
    }

    const entry = this.connections.get(path);

    if (this.idleTimers.has(path)) {
      clearTimeout(this.idleTimers.get(path));
      this.idleTimers.delete(path);
    }
    // A new subscriber is as good a reason to keep the socket as any, so cancel
    // the deferred teardown — otherwise a driver who returns to the radar
    // screen gets reaped on the next background transition.
    this.pendingIdle.delete(path);

    entry.terminated = false;
    // A channel that exhausted its backoff budget sits in "failed" until the
    // app is backgrounded and foregrounded again. A new subscriber is just as
    // good a reason to try again, so the budget is refilled here.
    if (entry.state === "failed") {
      entry.reconnectAttempts = 0;
    }

    entry.subscribers.set(id, { onMessage, onStateChange });
    console.log(`${LOG_TAG} subscribe #${id} path=${path} total=${entry.subscribers.size} isNew=${isNew} state=${entry.state}`);

    if (isNew || entry.state === "disconnected") {
      this._connect(path);
    }

    if (onStateChange) {
      try { onStateChange(entry.state); } catch {}
    }

    return () => {
      this._unsubscribe(path, id);
    };
  }

  /**
   * Sends a frame on a channel.
   *
   * When the socket is not OPEN the frame is buffered and flushed on the next
   * successful open instead of being dropped on the floor, which is what used
   * to happen: a GPS fix emitted during a reconnect window was simply lost, so
   * the passenger's marker froze for as long as the outage lasted.
   *
   * @returns {"sent"|"queued"|"dropped"} what actually happened to the frame.
   */
  send(path, type, payload = {}) {
    const frame = JSON.stringify({ type, ...payload, timestamp: Date.now() });
    const entry = this.connections.get(path);

    if (!entry) {
      console.log(
        `${LOG_TAG} send DROP path=${path} type=${type} no_channel (nobody is subscribed)`
      );
      return "dropped";
    }

    if (entry.socket && entry.socket.readyState === WebSocket.OPEN) {
      if (this._writeFrame(entry, path, frame)) return "sent";
      return this._enqueue(path, frame, type) ? "queued" : "dropped";
    }

    const readyState = entry.socket ? entry.socket.readyState : "no_socket";
    console.log(
      `${LOG_TAG} send QUEUE path=${path} type=${type} readyState=${readyState}`
    );
    return this._enqueue(path, frame, type) ? "queued" : "dropped";
  }

  _writeFrame(entry, path, frame) {
    try {
      entry.socket.send(frame);
      return true;
    } catch (err) {
      console.error(`${LOG_TAG} Send failed path=${path}:`, err);
      return false;
    }
  }

  _enqueue(path, frame, type) {
    let outbox = this.outboxes.get(path);
    if (!outbox) {
      outbox = [];
      this.outboxes.set(path, outbox);
    }
    const queuedAt = Date.now();
    outbox.push({ frame, type, queuedAt });
    if (outbox.length > WS_OUTBOX_MAX) {
      const dropped = outbox.shift();
      console.log(
        `${LOG_TAG} outbox OVERFLOW path=${path} type=${dropped.type} depth=${WS_OUTBOX_MAX}`
      );
    }
    return true;
  }

  /**
   * Flushes buffered frames once the socket is open again. Frames older than
   * WS_OUTBOX_TTL_MS are discarded: replaying a three-minute-old GPS fix would
   * move the vehicle backwards and is worse than dropping it.
   */
  _flushOutbox(path, entry) {
    const outbox = this.outboxes.get(path);
    if (!outbox || outbox.length === 0) return;

    const now = Date.now();
    const keep = [];
    let sent = 0;
    let expired = 0;

    for (const item of outbox) {
      if (now - item.queuedAt > WS_OUTBOX_TTL_MS) {
        expired += 1;
        continue;
      }
      if (this._writeFrame(entry, path, item.frame)) sent += 1;
      else keep.push(item);
    }

    if (keep.length > 0) this.outboxes.set(path, keep);
    else this.outboxes.delete(path);

    console.log(
      `${LOG_TAG} outbox FLUSH path=${path} sent=${sent} expired=${expired} requeued=${keep.length}`
    );
  }

  _dropOutbox(path) {
    if (this.outboxes.has(path)) {
      console.log(
        `${LOG_TAG} outbox DROP path=${path} frames=${this.outboxes.get(path).length}`
      );
      this.outboxes.delete(path);
    }
  }

  /**
   * Tears a channel down on purpose (explicit disconnect / logout).
   *
   * Reconnect suppression is an explicit `terminated` flag, not a poisoned
   * reconnectAttempts counter: the old hack left the entry in a state where a
   * later subscribe had to know about the abuse to recover, and it still
   * allowed `onclose` to schedule work for a socket the caller had closed.
   */
  disconnect(path, { dropQueue = true } = {}) {
    const entry = this.connections.get(path);
    if (!entry) return;
    console.log(`${LOG_TAG} disconnect path=${path}`);
    entry.terminated = true;
    this.keepAlivePaths.delete(path);
    if (this.idleTimers.has(path)) {
      clearTimeout(this.idleTimers.get(path));
      this.idleTimers.delete(path);
    }
    this.pendingIdle.delete(path);
    clearTimeout(entry.reconnectTimer);
    entry.reconnectTimer = null;
    entry._connecting = false;
    if (entry.socket) {
      entry.socket.onopen = null;
      entry.socket.onmessage = null;
      entry.socket.onerror = null;
      entry.socket.onclose = null;
      entry.socket.close();
      entry.socket = null;
    }
    entry.state = "disconnected";
    if (dropQueue) this._dropOutbox(path);
    this.connections.delete(path);
  }

  disconnectAll() {
    for (const path of [...this.connections.keys()]) {
      this.disconnect(path);
    }
  }

  _connect(path) {
    const entry = this.connections.get(path);
    if (!entry || entry.subscribers.size === 0) {
      console.log(`${LOG_TAG} _connect SKIP path=${path} no_entry=${!entry} subs=${entry?.subscribers.size}`);
      return;
    }

    if (entry._connecting) {
      console.log(`${LOG_TAG} _connect SKIP path=${path} already_connecting`);
      return;
    }

    if (entry.socket && (entry.socket.readyState === WebSocket.OPEN || entry.socket.readyState === WebSocket.CONNECTING)) {
      console.log(`${LOG_TAG} _connect SKIP path=${path} socket_readyState=${entry.socket.readyState}`);
      return;
    }

    this._connectInternal(path);
  }

  async _connectInternal(path) {
    const entry = this.connections.get(path);
    if (!entry || entry.subscribers.size === 0) {
      console.log(`${LOG_TAG} _connectInternal SKIP path=${path} no_entry=${!entry} subs=${entry?.subscribers.size}`);
      return;
    }

    if (entry._connecting || entry.socket) {
      console.log(`${LOG_TAG} _connectInternal SKIP path=${path} connecting=${entry._connecting} hasSocket=${!!entry.socket}`);
      return;
    }

    entry._connecting = true;
    console.log(`${LOG_TAG} _connectInternal START path=${path}`);

    try {
      const token =
        (await AsyncStorage.getItem(STORAGE_KEYS.accessToken)) ||
        (await AsyncStorage.getItem(STORAGE_KEYS.token));
      const baseUrl = getWsUrl(path);
      // omv-backend authenticates sockets from "?token=<access jwt>" only
      // (common/websockets/auth.py). A Sec-WebSocket-Protocol token is ignored,
      // the user stays anonymous and Daphne answers "403 Access denied".
      const url = token
        ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
        : baseUrl;

      // Re-check after async gap — state may have changed during await
      if (entry._connecting === false || entry.socket) {
        console.log(`${LOG_TAG} _connectInternal ABORT path=${path} state_changed connecting=${entry._connecting} hasSocket=${!!entry.socket}`);
        return;
      }

      this._setState(path, "connecting");

      const ws = new WebSocket(url);
      entry.socket = ws;
      entry._connecting = false;

      console.log(`${LOG_TAG} _connectInternal WS_CREATED path=${path} auth=${token ? "query-token" : "none"}`);

      ws.onopen = () => {
        if (entry.socket !== ws) return;
        entry.reconnectAttempts = 0;
        console.log(`${LOG_TAG} WS_OPEN path=${path}`);
        this._setState(path, "connected");
        this._flushOutbox(path, entry);
      };

      ws.onmessage = (event) => {
        if (entry.socket !== ws) return;
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          for (const { onMessage } of entry.subscribers.values()) {
            try { onMessage(data); } catch (err) {
              console.error(`${LOG_TAG} Subscriber error:`, err);
            }
          }
        } catch (err) {
          console.error(`${LOG_TAG} Malformed payload:`, err);
        }
      };

      ws.onerror = () => {};

      ws.onclose = (event) => {
        if (entry.socket !== ws) return;
        entry.socket = null;
        entry._connecting = false;
        console.log(`${LOG_TAG} WS_CLOSE path=${path} code=${event.code} reason=${event.reason}`);
        this._setState(path, "disconnected");

        // Explicit disconnect()/logout: the caller asked for this, so no retry.
        if (entry.terminated) {
          console.log(`${LOG_TAG} WS_CLOSE ignored path=${path} reason=terminated`);
          return;
        }

        if (AppState.currentState !== "active") {
          // Timers are unreliable while backgrounded. Leave the channel in
          // "disconnected" and let the app-state listener re-open it on
          // foreground, instead of burning the retry budget on a timer that
          // may never fire.
          console.log(
            `${LOG_TAG} WS_CLOSE deferred path=${path} appState=${AppState.currentState}`
          );
          return;
        }

        this._scheduleReconnect(path, entry);
      };
    } catch (err) {
      console.error(`${LOG_TAG} _connectInternal ERROR path=${path}`, err);
      entry.socket = null;
      entry._connecting = false;
      this._setState(path, "disconnected");
      this._scheduleReconnect(path, entry);
    }
  }

  /**
   * Exponential backoff with jitter: base * 2^attempt, capped, then jittered by
   * +/- WS_RECONNECT_JITTER so every client that dropped with the gateway does
   * not come back on the same millisecond.
   */
  _reconnectDelay(attempt) {
    const baseMs = Number.isFinite(WS_RECONNECT_BASE_MS) ? WS_RECONNECT_BASE_MS : 1000;
    const maxMs = Number.isFinite(WS_RECONNECT_MAX_MS) ? WS_RECONNECT_MAX_MS : 30000;
    const jitter = Number.isFinite(WS_RECONNECT_JITTER) ? WS_RECONNECT_JITTER : 0.25;
    const base = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    const spread = base * jitter;
    return Math.max(250, Math.round(base + (Math.random() * 2 - 1) * spread));
  }

  _scheduleReconnect(path, entry) {
    if (entry.terminated) return;
    if (entry.subscribers.size === 0) {
      console.log(
        `${LOG_TAG} RECONNECT skip path=${path} no_subscribers`
      );
      return;
    }
    if (entry.reconnectTimer) {
      clearTimeout(entry.reconnectTimer);
      entry.reconnectTimer = null;
    }
    if (entry.reconnectAttempts >= WS_MAX_RECONNECT) {
      console.log(
        `${LOG_TAG} FAILED path=${path} max_retries_reached attempts=${entry.reconnectAttempts}`
      );
      this._setState(path, "failed");
      return;
    }

    entry.reconnectAttempts += 1;
    const delay = this._reconnectDelay(entry.reconnectAttempts);
    console.log(
      `${LOG_TAG} RECONNECT path=${path} attempt=${entry.reconnectAttempts}/${WS_MAX_RECONNECT} delay=${delay}ms`
    );
    this._setState(path, "reconnecting");
    entry.reconnectTimer = setTimeout(() => {
      entry.reconnectTimer = null;
      if (entry.terminated) return;
      this._connectInternal(path);
    }, delay);
  }

  _unsubscribe(path, id) {
    const entry = this.connections.get(path);
    if (!entry) return;
    entry.subscribers.delete(id);
    console.log(`${LOG_TAG} unsubscribe #${id} path=${path} remaining=${entry.subscribers.size}`);

    if (entry.subscribers.size === 0 && !this.keepAlivePaths.has(path)) {
      this._startIdleTimer(path);
    }
  }

  /**
   * Tearing down an unsubscribed channel is normally the right thing, but the
   * old fixed 60s timer could close a socket belonging to a driver who was
   * still waiting for work, and replacing that with a self-re-arming timer was
   * worse: the timer never converged, so an abandoned socket stayed open for the
   * whole life of the session.
   *
   * The grace period is now only the *first* leg. Once it expires the channel is
   * marked in `pendingIdle` and the actual close is left to the next background
   * transition (`_reapPendingIdle`). A new subscriber cancels both the timer and
   * the pending mark, so nothing is reaped out from under a live consumer.
   */
  _startIdleTimer(path) {
    if (this.idleTimers.has(path) || this.pendingIdle.has(path)) return;
    this.idleTimers.set(
      path,
      setTimeout(() => {
        this.idleTimers.delete(path);
        const entry = this.connections.get(path);
        if (entry && entry.subscribers.size > 0) return;
        if (this.keepAlivePaths.has(path)) return;

        if (AppState.currentState === "active") {
          if (!this.pendingIdle.has(path)) {
            console.log(
              `${LOG_TAG} idle PENDING path=${path} app in foreground, reaping on background`
            );
          }
          this.pendingIdle.add(path);
          return;
        }

        this.disconnect(path);
      }, WS_IDLE_TTL_MS)
    );
  }

  _setState(path, state) {
    const entry = this.connections.get(path);
    if (!entry) return;
    const prev = entry.state;
    entry.state = state;
    if (prev !== state) {
      console.log(`${LOG_TAG} STATE path=${path} ${prev} → ${state}`);
    }
    for (const { onStateChange } of entry.subscribers.values()) {
      try { onStateChange(state); } catch {}
    }
  }

}

export default new SocketManager();