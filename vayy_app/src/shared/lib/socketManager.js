import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWsUrl } from "./wsUrl";
import { STORAGE_KEYS, WS, WS_MAX_RECONNECT } from "../../constants";

class SocketManager {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = WS_MAX_RECONNECT;
    this.listeners = new Map();
    this.isConnected = false;
  }

  async connect(path = WS.cityPublic) {
    if (this.socket) {
      this.socket.close();
    }

    const token = await AsyncStorage.getItem(STORAGE_KEYS.accessToken) || await AsyncStorage.getItem(STORAGE_KEYS.token);
    const url = getWsUrl(path) + (token ? `?token=${token}` : "");

    console.log("[SocketManager] Connecting to:", url);

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log("[SocketManager] Connected");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit("connected", null);
    };

    this.socket.onmessage = (event) => {
      try {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        
        if (__DEV__) console.log("[SocketManager] Message:", data.type || "unknown");
        
        // Basic validation: ensure type exists
        if (!data.type) {
          console.warn("[SocketManager] Received message without type:", data);
          return;
        }

        this.emit(data.type, data);
        this.emit("message", data); // Global listener
      } catch (err) {
        console.error("[SocketManager] Malformed WebSocket payload:", err, event.data);
      }
    };

    this.socket.onerror = (error) => {
      if (__DEV__) console.error("[SocketManager] WebSocket Error:", error);
      this.emit("error", error);
    };

    this.socket.onclose = (event) => {
      this.isConnected = false;
      if (__DEV__) console.log("[SocketManager] Disconnected", event.code, event.reason);
      this.emit("disconnected", { code: event.code, reason: event.reason });
      this.emit("state_change", "disconnected");

      // Exponential backoff for reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const timeout = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.emit("state_change", "reconnecting");
        setTimeout(() => this.connect(path), timeout);
      } else {
        this.emit("state_change", "failed");
      }
    };
  }

  send(type, payload) {
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({ type, ...payload, timestamp: Date.now() });
        this.socket.send(message);
      } catch (err) {
        console.error("[SocketManager] Failed to send message:", err);
      }
    } else {
      if (__DEV__) console.warn("[SocketManager] Socket not ready. Message queued or dropped.");
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event).filter((cb) => cb !== callback);
    this.listeners.set(event, callbacks);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => cb(data));
    }
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.socket) {
      this.socket.close();
    }
  }
}

export default new SocketManager();
