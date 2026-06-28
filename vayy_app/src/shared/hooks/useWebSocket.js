import { useEffect, useRef, useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getWsUrl } from "../lib/wsUrl";
import { STORAGE_KEYS } from "../../constants";

const MAX_RECONNECT = 5;

/**
 * Self-contained WebSocket hook — each instance owns its own connection.
 * No shared singleton, no cross-component interference.
 */
export default function useWebSocket(path, options = {}) {
  const { onMessage, autoConnect = true, enabled = true } = options;
  const [connectionState, setConnectionState] = useState("disconnected");
  const wsRef = useRef(null);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const pathRef = useRef(path);
  const onMessageRef = useRef(onMessage);

  // Keep refs fresh without triggering re-connect
  pathRef.current = path;
  onMessageRef.current = onMessage;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    reconnectRef.current = MAX_RECONNECT; // prevent stale reconnect
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    cleanup();

    const currentPath = pathRef.current;
    if (!currentPath) return;

    try {
      const token =
        (await AsyncStorage.getItem(STORAGE_KEYS.accessToken)) ||
        (await AsyncStorage.getItem(STORAGE_KEYS.token));
      const url = getWsUrl(currentPath) + (token ? `?token=${token}` : "");

      console.log("[useWebSocket] Connecting to:", url);
      setConnectionState("connecting");

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current || ws !== wsRef.current) return;
        console.log("[useWebSocket] Connected:", currentPath);
        reconnectRef.current = 0;
        setConnectionState("connected");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current || ws !== wsRef.current) return;
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch (err) {
          console.error("[useWebSocket] Malformed payload:", err);
        }
      };

      ws.onerror = (error) => {
        if (__DEV__) console.error("[useWebSocket] Error:", error);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current || ws !== wsRef.current) return;
        console.log("[useWebSocket] Disconnected:", event.code, event.reason);
        setConnectionState("disconnected");
        wsRef.current = null;

        // Auto-reconnect with exponential backoff
        if (reconnectRef.current < MAX_RECONNECT) {
          reconnectRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectRef.current), 30000);
          setConnectionState("reconnecting");
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connect();
          }, delay);
        } else {
          setConnectionState("failed");
        }
      };
    } catch (err) {
      console.error("[useWebSocket] Connect failed:", err);
      setConnectionState("failed");
    }
  }, [cleanup]);

  // Mount / path / enabled changes
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect && enabled && path) {
      reconnectRef.current = 0;
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [path, autoConnect, enabled, connect, cleanup]);

  const send = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type, ...payload, timestamp: Date.now() }));
      } catch (err) {
        console.error("[useWebSocket] Send failed:", err);
      }
    }
  }, []);

  return { send, connectionState, isConnected: connectionState === "connected" };
}
