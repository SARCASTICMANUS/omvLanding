// VAYY | src/components/Shared/NotificationHandler.jsx
// Global real-time notification listener. Shares its socket with
// NotificationsPage (same `notifications-<userId>` key) so only one
// WebSocket is opened for the authenticated user.
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";
import { useSocketSubscription } from "../../hooks/useSocketSubscription";
import { pushPassengerNotification } from "../../redux/slices/passengerSlice";
import notificationService from "../../services/notificationService";

const normalizeNotification = (data) => {
  if (!data?.title || !data?.message) return null;

  return {
    id: data.id,
    title: data.title,
    message: data.message,
    notification_type: data.notification_type || data.type || "in_app",
    created_at: data.created_at || new Date().toISOString(),
    metadata: data.metadata,
    read: false,
  };
};

const NotificationHandler = () => {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated } = useSelector((state) => state.auth);
  const [fallbackUserId, setFallbackUserId] = useState(null);
  const meRan = useRef(false);

  const accessToken = token || localStorage.getItem("access_token");
  const userId = user?.id || fallbackUserId;

  // Sessions restored before ids were persisted hold a user without `id`.
  useEffect(() => {
    if (meRan.current || user?.id || !isAuthenticated) return;
    meRan.current = true;
    api
      .get(API_PATHS.auth.me)
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        if (payload?.id) setFallbackUserId(payload.id);
      })
      .catch(() => {});
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    notificationService.requestPermission();
  }, []);

  const handleWsMessage = (message) => {
    const notification = normalizeNotification(message);
    if (!notification) return;

    dispatch(pushPassengerNotification(notification));
    notificationService.notify(notification.title, {
      body: notification.message,
      tag: `notification-${notification.id || notification.created_at}`,
    });
  };

  useSocketSubscription({
    key: userId ? `notifications-${userId}` : null,
    path: userId ? API_PATHS.sockets.passenger(userId, accessToken) : null,
    enabled: !!userId && !!accessToken,
    onMessage: handleWsMessage,
  });

  return null;
};

export default NotificationHandler;
