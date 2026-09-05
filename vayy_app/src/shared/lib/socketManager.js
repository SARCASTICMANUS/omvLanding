import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { getWsUrl } from "./wsUrl";
import { STORAGE_KEYS, WS_MAX_RECONNECT } from "../../constants";

const IDLE_TTL = 60000;
const LOG_TAG = "[SocketManager]";

let _idCounter = 0;

class SocketManager {
  constructor() {
    this.connections = new Map();
    this.keepAlivePaths = new Set();
    this.idleTimers = new Map();
  }

  keepAlive(path) {
    if (!path) return;
    this.keepAlivePaths.add(path);
    const entry = this.connections.get(path);
    console.log(`${LOG_TAG} keepAlive path=${path} exists=${!!entry} state=${entry?.state} subs=${entry?.subscribers.size}`);
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
      });
    }

    const entry = this.connections.get(path);

    if (this.idleTimers.has(path)) {
      clearTimeout(this.idleTimers.get(path));
      this.idleTimers.delete(path);
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

  send(path, type, payload = {}) {
    const entry = this.connections.get(path);
    if (!entry || !entry.socket) {
      console.log(`${LOG_TAG} send SKIP path=${path} type=${type} no_socket`);
      return;
    }
    if (entry.socket.readyState !== WebSocket.OPEN) {
      console.log(`${LOG_TAG} send SKIP path=${path} type=${type} readyState=${entry.socket.readyState}`);
      return;
    }
    try {
      entry.socket.send(JSON.stringify({ type, ...payload, timestamp: Date.now() }));
    } catch (err) {
      console.error(`${LOG_TAG} Send failed:`, err);
    }
  }

  disconnect(path) {
    const entry = this.connections.get(path);
    if (!entry) return;
    console.log(`${LOG_TAG} disconnect path=${path}`);
    this.keepAlivePaths.delete(path);
    if (this.idleTimers.has(path)) {
      clearTimeout(this.idleTimers.get(path));
      this.idleTimers.delete(path);
    }
    entry.reconnectAttempts = WS_MAX_RECONNECT;
    entry._connecting = false;
    clearTimeout(entry.reconnectTimer);
    if (entry.socket) {
      entry.socket.onopen = null;
      entry.socket.onmessage = null;
      entry.socket.onerror = null;
      entry.socket.onclose = null;
      entry.socket.close();
      entry.socket = null;
    }
    entry.state = "disconnected";
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
      const url = getWsUrl(path) + (token ? `?token=${token}` : "");

      // Re-check after async gap — state may have changed during await
      if (entry._connecting === false || entry.socket) {
        console.log(`${LOG_TAG} _connectInternal ABORT path=${path} state_changed connecting=${entry._connecting} hasSocket=${!!entry.socket}`);
        return;
      }

      this._setState(path, "connecting");

      const ws = new WebSocket(url);
      entry.socket = ws;
      entry._connecting = false;

      console.log(`${LOG_TAG} _connectInternal WS_CREATED path=${path}`);

      ws.onopen = () => {
        if (entry.socket !== ws) return;
        entry.reconnectAttempts = 0;
        console.log(`${LOG_TAG} WS_OPEN path=${path}`);
        this._setState(path, "connected");
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

        if (AppState.currentState !== "active") return;

        if (entry.reconnectAttempts < WS_MAX_RECONNECT && entry.subscribers.size > 0) {
          entry.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, entry.reconnectAttempts), 30000);
          console.log(`${LOG_TAG} RECONNECT path=${path} attempt=${entry.reconnectAttempts} delay=${delay}ms`);
          this._setState(path, "reconnecting");
          entry.reconnectTimer = setTimeout(() => {
            entry.reconnectTimer = null;
            this._connectInternal(path);
          }, delay);
        } else if (entry.subscribers.size > 0) {
          console.log(`${LOG_TAG} FAILED path=${path} max_retries_reached`);
          this._setState(path, "failed");
        }
      };
    } catch (err) {
      console.error(`${LOG_TAG} _connectInternal ERROR path=${path}`, err);
      entry.socket = null;
      entry._connecting = false;
      this._setState(path, "disconnected");
    }
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

  _startIdleTimer(path) {
    if (this.idleTimers.has(path)) return;
    this.idleTimers.set(path, setTimeout(() => {
      this.idleTimers.delete(path);
      this.disconnect(path);
    }, IDLE_TTL));
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