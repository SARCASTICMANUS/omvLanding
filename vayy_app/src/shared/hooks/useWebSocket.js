import { useEffect, useRef, useCallback, useState } from "react";
import socketManager from "../lib/socketManager";
import { useWebSocketContext } from "../lib/WebSocketProvider";

const CHANNEL_TO_ID_KEY = {
  dispatch: "dispatchId",
  broadcast: "broadcastId",
  trackingTrip: "tripId",
  trackingVehicle: "vehicleId",
};

function resolveChannel(path) {
  if (!path) return null;
  if (path.match(/^\/ws\/notifications\//)) return "notification";
  if (path.match(/^\/ws\/dispatch\/broadcast\//)) return "broadcast";
  if (path.match(/^\/ws\/dispatch\//)) return "dispatch";
  if (path.match(/^\/ws\/tracking\/trip\//)) return "trackingTrip";
  if (path.match(/^\/ws\/tracking\/vehicle\//)) return "trackingVehicle";
  return null;
}

function extractId(path) {
  if (!path) return null;
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || null;
}

export default function useWebSocket(path, options = {}) {
  const { onMessage, enabled = true } = options;
  const [connectionState, setConnectionState] = useState("disconnected");
  const onMessageRef = useRef(onMessage);
  const pathRef = useRef(path);

  onMessageRef.current = onMessage;
  pathRef.current = path;

  const wsContext = useWebSocketContext();
  const channel = path ? resolveChannel(path) : null;
  const idsSetRef = useRef(false);

  useEffect(() => {
    if (!enabled || !path) {
      setConnectionState("disconnected");
      return;
    }

    if (channel && !idsSetRef.current) {
      const key = CHANNEL_TO_ID_KEY[channel];
      if (key) {
        wsContext.setChannelIds({ [key]: extractId(path) });
        idsSetRef.current = true;
      }
    }

    const unsub = socketManager.subscribe(path, {
      onMessage: (data) => {
        onMessageRef.current?.(data);
      },
      onStateChange: (state) => {
        setConnectionState(state);
      },
    });

    setConnectionState(
      socketManager.connections.get(path)?.state || "disconnected"
    );

    return () => {
      unsub();
    };
  }, [path, enabled, channel]);

  const send = useCallback(
    (type, payload) => {
      if (!pathRef.current) return;
      socketManager.send(pathRef.current, type, payload);
    },
    [],
  );

  return {
    send,
    connectionState,
    isConnected: connectionState === "connected",
  };
}