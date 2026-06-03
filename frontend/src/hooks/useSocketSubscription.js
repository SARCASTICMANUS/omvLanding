import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import socketManager from "../services/sockets/socketManager";
import {
  socketConnectionChanged,
  socketConnectionRemoved,
  socketEventReceived,
} from "../redux/slices/websocketSlice";

export const useSocketSubscription = ({
  key,
  path,
  enabled = true,
  onMessage,
  options,
}) => {
  const dispatch = useDispatch();
  const messageHandlerRef = useRef(onMessage);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    messageHandlerRef.current = onMessage;
  }, [onMessage]);

  const stableOptions = useMemo(() => options || {}, [options]);

  useEffect(() => {
    if (!enabled || !key || !path) return undefined;

    const unsubscribeMessages = socketManager.subscribe(
      key,
      path,
      (message, event) => {
        dispatch(
          socketEventReceived({
            key,
            type: message?.type || "message",
            receivedAt: Date.now(),
          }),
        );
        messageHandlerRef.current?.(message, event);
      },
      stableOptions,
    );

    const unsubscribeStatus = socketManager.onStatus(key, (payload) => {
      setStatus(payload.status);
      dispatch(
        socketConnectionChanged({
          key: payload.key,
          url: payload.url,
          status: payload.status,
          connectedAt: payload.status === "open" ? Date.now() : undefined,
          closedAt: payload.status === "closed" ? Date.now() : undefined,
        }),
      );
    });

    return () => {
      unsubscribeMessages();
      unsubscribeStatus();
      dispatch(socketConnectionRemoved(key));
    };
  }, [dispatch, enabled, key, path, stableOptions]);

  const send = useMemo(() => {
    return (payload) => socketManager.send(key, payload);
  }, [key]);

  const disconnect = useMemo(() => {
    return () => socketManager.disconnect(key);
  }, [key]);

  return {
    status,
    // send: (payload) => socketManager.send(key, payload),
    // disconnect: () => socketManager.disconnect(key),
    send,
    disconnect,
  };
};
