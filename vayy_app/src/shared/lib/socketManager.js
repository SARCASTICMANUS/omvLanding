import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { getWsUrl } from "./wsUrl";
import { STORAGE_KEYS, WS_MAX_RECONNECT } from "../../constants";

const IDLE_TTL = 60000;

let _idCounter = 0;

class SocketManager {
  constructor() {
    this.connections = new Map();
    this.keepAlivePaths = new Set();
    this.idleTimers = new Map();
    AppState.addEventListener("change", (state) => {
      if (state === "background") this._pauseAll();
      if (state === "active") this._resumeAll();
    });
  }

  keepAlive(path) {
    if (!path) return;
    this.keepAlivePaths.add(path);
    const entry = this.connections.get(path);
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
        paused: false,
      });
    }

    const entry = this.connections.get(path);

    if (this.idleTimers.has(path)) {
      clearTimeout(this.idleTimers.get(path));
      this.idleTimers.delete(path);
    }

    entry.subscribers.set(id, { onMessage, onStateChange });

    if (isNew || (entry.state === "disconnected" && !entry.paused)) {
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
    if (!entry || !entry.socket) return;
    if (entry.socket.readyState !== WebSocket.OPEN) return;
    try {
      entry.socket.send(JSON.stringify({ type, ...payload, timestamp: Date.now() }));
    } catch (err) {
      console.error("[SocketManager] Send failed:", err);
    }
  }

  disconnect(path) {
    const entry = this.connections.get(path);
    if (!entry) return;
    this.keepAlivePaths.delete(path);
    if (this.idleTimers.has(path)) {
      clearTimeout(this.idleTimers.get(path));
      this.idleTimers.delete(path);
    }
    entry.reconnectAttempts = WS_MAX_RECONNECT;
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
    if (!entry || entry.subscribers.size === 0) return;

    if (entry.socket && (entry.socket.readyState === WebSocket.OPEN || entry.socket.readyState === WebSocket.CONNECTING)) return;

    this._connectInternal(path);
  }

  async _connectInternal(path) {
    const entry = this.connections.get(path);
    if (!entry || entry.subscribers.size === 0) return;

    const token =
      (await AsyncStorage.getItem(STORAGE_KEYS.accessToken)) ||
      (await AsyncStorage.getItem(STORAGE_KEYS.token));
    const url = getWsUrl(path) + (token ? `?token=${token}` : "");

    entry.paused = false;
    this._setState(path, "connecting");

    const ws = new WebSocket(url);
    entry.socket = ws;

    ws.onopen = () => {
      if (entry.socket !== ws) return;
      entry.reconnectAttempts = 0;
      this._setState(path, "connected");
    };

    ws.onmessage = (event) => {
      if (entry.socket !== ws) return;
      try {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        for (const { onMessage } of entry.subscribers.values()) {
          try { onMessage(data); } catch (err) {
            console.error("[SocketManager] Subscriber error:", err);
          }
        }
      } catch (err) {
        console.error("[SocketManager] Malformed payload:", err);
      }
    };

    ws.onerror = () => {};

    ws.onclose = (event) => {
      if (entry.socket !== ws) return;
      entry.socket = null;
      this._setState(path, "disconnected");

      if (entry.paused) return;

      if (entry.reconnectAttempts < WS_MAX_RECONNECT && entry.subscribers.size > 0) {
        entry.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, entry.reconnectAttempts), 30000);
        this._setState(path, "reconnecting");
        entry.reconnectTimer = setTimeout(() => {
          entry.reconnectTimer = null;
          this._connectInternal(path);
        }, delay);
      } else if (entry.subscribers.size > 0) {
        this._setState(path, "failed");
      }
    };
  }

  _unsubscribe(path, id) {
    const entry = this.connections.get(path);
    if (!entry) return;
    entry.subscribers.delete(id);

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
    entry.state = state;
    for (const { onStateChange } of entry.subscribers.values()) {
      try { onStateChange(state); } catch {}
    }
  }

  _pauseAll() {
    for (const [path, entry] of this.connections) {
      if (entry.socket) {
        entry.paused = true;
        entry.socket.onopen = null;
        entry.socket.onmessage = null;
        entry.socket.onerror = null;
        entry.socket.onclose = null;
        entry.socket.close();
        entry.socket = null;
      }
      entry.state = "disconnected";
    }
  }

  _resumeAll() {
    for (const [path, entry] of this.connections) {
      entry.paused = false;
      if (entry.subscribers.size > 0) {
        this._connectInternal(path);
      }
    }
  }
}

export default new SocketManager();