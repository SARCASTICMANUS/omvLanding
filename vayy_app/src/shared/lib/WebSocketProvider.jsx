import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import socketManager from "./socketManager";
import { WS } from "../../constants";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const userId = user?.id;

  const [activeIds, setActiveIds] = useState({
    dispatchId: null,
    tripId: null,
    vehicleId: null,
    broadcastId: null,
  });

  useEffect(() => {
    if (userId) {
      socketManager.keepAlive(WS.notifications(userId));
    }
    return () => {
      if (userId) {
        socketManager.releaseKeepAlive(WS.notifications(userId));
      }
    };
  }, [userId]);

  const setChannelIds = useCallback((ids) => {
    setActiveIds((prev) => {
      if (
        prev.dispatchId === ids.dispatchId &&
        prev.tripId === ids.tripId &&
        prev.vehicleId === ids.vehicleId &&
        prev.broadcastId === ids.broadcastId
      ) {
        return prev;
      }
      return { ...prev, ...ids };
    });
  }, []);

  const value = useMemo(() => ({
    setChannelIds,
    activeIds,
    userId,
  }), [setChannelIds, activeIds, userId]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketContext must be used within a WebSocketProvider");
  }
  return ctx;
}

export default WebSocketProvider;