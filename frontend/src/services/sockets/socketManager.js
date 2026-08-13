import { env } from "../../config/env";
import { getWsUrl } from "../api/client";

const DEFAULT_OPTIONS = {
  reconnect: true,
  maxAttempts: env.socketReconnectAttempts,
  baseDelay: env.socketReconnectBaseDelay,
};

const parseSocketMessage = (event) => {
  try {
    return JSON.parse(event.data);
  } catch {
    return event.data;
  }
};

class SocketManager {
  connections = new Map();

  connect(key, path, options = {}) {
    const config = { ...DEFAULT_OPTIONS, ...options };
    const existing = this.connections.get(key);

    if (existing?.socket?.readyState === WebSocket.OPEN || existing?.socket?.readyState === WebSocket.CONNECTING) {
      return existing;
    }

    const url = path.startsWith("ws://") || path.startsWith("wss://") ? path : getWsUrl(path);
    const connection = {
      key,
      url,
      socket: null,
      listeners: new Set(),
      statusListeners: new Set(),
      reconnectTimer: null,
      reconnectAttempts: 0,
      manuallyClosed: false,
      options: config,
    };

    this.connections.set(key, connection);
    this.open(connection);
    return connection;
  }

  open(connection) {
    connection.socket = new WebSocket(connection.url);
    this.emitStatus(connection, "connecting");

    connection.socket.onopen = () => {
      connection.reconnectAttempts = 0;
      this.emitStatus(connection, "open");
    };

    connection.socket.onmessage = (event) => {
      const message = parseSocketMessage(event);
      connection.listeners.forEach((listener) => listener(message, event));
    };

    connection.socket.onerror = (event) => {
      this.emitStatus(connection, "error", event);
    };

    connection.socket.onclose = (event) => {
      this.emitStatus(connection, "closed", event);

      if (!connection.manuallyClosed && connection.options.reconnect) {
        this.scheduleReconnect(connection);
      }
    };
  }

  scheduleReconnect(connection) {
    if (connection.reconnectAttempts >= connection.options.maxAttempts) {
      this.emitStatus(connection, "failed");
      return;
    }

    connection.reconnectAttempts += 1;
    const delay = Math.min(
      connection.options.baseDelay * 2 ** (connection.reconnectAttempts - 1),
      15000,
    );

    window.clearTimeout(connection.reconnectTimer);
    connection.reconnectTimer = window.setTimeout(() => {
      this.open(connection);
    }, delay);
  }

  subscribe(key, path, listener, options = {}) {
    const connection = this.connect(key, path, options);
    connection.listeners.add(listener);

    return () => {
      connection.listeners.delete(listener);
      if (connection.listeners.size === 0 && options.closeWhenIdle !== false) {
        this.disconnect(key);
      }
    };
  }

  onStatus(key, listener) {
    const connection = this.connections.get(key);
    if (!connection) return () => {};

    connection.statusListeners.add(listener);
    return () => connection.statusListeners.delete(listener);
  }

  emitStatus(connection, status, event = null) {
    connection.statusListeners.forEach((listener) => {
      listener({
        key: connection.key,
        url: connection.url,
        status,
        event,
        reconnectAttempts: connection.reconnectAttempts,
      });
    });
  }

  send(key, payload) {
    const connection = this.connections.get(key);
    if (!connection?.socket || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    connection.socket.send(typeof payload === "string" ? payload : JSON.stringify(payload));
    return true;
  }

  disconnect(key) {
    const connection = this.connections.get(key);
    if (!connection) return;

    connection.manuallyClosed = true;
    window.clearTimeout(connection.reconnectTimer);
    connection.socket?.close();
    this.connections.delete(key);
  }

  disconnectAll() {
    Array.from(this.connections.keys()).forEach((key) => this.disconnect(key));
  }
}

export const socketManager = new SocketManager();
export default socketManager;
