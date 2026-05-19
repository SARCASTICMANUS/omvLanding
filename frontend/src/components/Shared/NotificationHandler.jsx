// VAYY | src/components/Shared/NotificationHandler.jsx
import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { getWsUrl } from "../../lib/api";
import notificationService from "../../services/notificationService";

const NotificationHandler = () => {
  const { user } = useSelector((state) => state.auth);
  const ws = useRef(null);

  useEffect(() => {
    if (!user) return;

    // Connect to a global user group for alerts
    const token = localStorage.getItem("access_token");
    // We use a generic role since connect() handles user group joining based on authenticated scope
    const wsUrl = getWsUrl(`/ws/public/global/${user.role}/alerts/?token=${token}`);
    
    const connect = () => {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("[Notifications] Connected to alert stream");
        notificationService.requestPermission();
      };

      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === "trip_started") {
            notificationService.notify("Trip Started", {
              body: data.message,
              tag: "trip-started"
            });
          } else if (data.type === "proximity_alert") {
            notificationService.notify("Bus Nearby!", {
              body: data.message,
              tag: `proximity-${data.trip_id}`
            });
          } else if (data.type === "manifest_update" && user.role === "driver") {
             // Optional: notify driver of manifest changes if app is in background
             if (document.hidden) {
                notificationService.notify("Manifest Updated", {
                  body: "Your trip manifest has new updates.",
                  tag: "manifest-update"
                });
             }
          }
        } catch (err) {
          console.error("[Notifications] Error processing message:", err);
        }
      };

      ws.current.onclose = () => {
        console.log("[Notifications] Reconnecting in 5s...");
        setTimeout(connect, 5000);
      };

      ws.current.onerror = (err) => {
        console.error("[Notifications] WebSocket error:", err);
        ws.current.close();
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
      }
    };
  }, [user]);

  return null; // This component doesn't render anything
};

export default NotificationHandler;
