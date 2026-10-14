import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import * as Notifications from "expo-notifications";

import socketManager from "../lib/socketManager";
import { WS } from "../../constants";
import { isDriverRole, ROLE } from "../../constants/roles";
import { addNotification } from "../../store/slices/notificationSlice";
import {
  configureNotificationHandler,
  drainBackgroundNotifications,
  ensureAndroidChannel,
  registerBackgroundHandler,
  registerPushToken,
  toNotificationPayload,
} from "../lib/pushNotifications";

let _idCounter = 0;
function uniqueId() {
  _idCounter += 1;
  return `ntf_${Date.now()}_${_idCounter}`;
}

// The backend fans the same notification out over both the WebSocket and
// push, so a driver with the app open would otherwise see every message twice.
// Suppress an identical title+message that lands on the other channel.
const DUPE_WINDOW_MS = 10000;
const _recentlyShown = new Map();

function isDuplicate(notification) {
  if (!notification) return false;
  const key = `${notification.title}|${notification.message}`;
  const now = Date.now();
  for (const [k, at] of _recentlyShown) {
    if (now - at > DUPE_WINDOW_MS) _recentlyShown.delete(k);
  }
  if (_recentlyShown.has(key)) return true;
  _recentlyShown.set(key, now);
  return false;
}

export default function useNotificationListener(toastRef) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { user } = useSelector((state) => state.auth);
  const userId = user?.id;
  const role = user?.role;
  const navigationRef = useRef(navigation);
  const dispatchRef = useRef(dispatch);
  const roleRef = useRef(role);

  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const present = useRef((notification) => {
    if (!notification) return;
    if (isDuplicate(notification)) return;
    dispatchRef.current(addNotification(notification));
    toastRef.current?.show({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      timestamp: notification.timestamp,
      onPress: () => handleNotificationPress(notification, navigationRef.current, roleRef.current),
    });
  }).current;

  // Foreground presentation is shared by the WebSocket channel, the push
  // listener and the drained background queue.
  const handleIncoming = useCallback((raw) => {
    const notification = normalizeNotification(raw);
    if (!notification) return;
    present(notification);
  }, [present]);

  // A tap that launched the app from the killed state never reaches
  // addNotificationResponseReceivedListener, so it is picked up here instead.
  // useLastNotificationResponse is not available on web, so this is a no-op there.
  const handledResponseRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const lastResponse = Notifications.getLastNotificationResponse();
    if (!lastResponse) return;
    const response = lastResponse?.notification?.request?.identifier;
    if (!response || handledResponseRef.current === response) return;
    handledResponseRef.current = response;

    const payload = toNotificationPayload(lastResponse.notification);
    if (!payload) return;
    const notification = normalizeNotification({ ...payload.data, type: "push" });
    if (!notification) return;
    handleNotificationPress(notification, navigationRef.current, roleRef.current);
  }, []);

  useEffect(() => {
    if (!userId) return;

    const wsPath = WS.notifications(userId);

    const unsub = socketManager.subscribe(wsPath, {
      onMessage: (data) => handleIncoming(data),
    });

    return unsub;
  }, [userId, handleIncoming]);

  // Push: foreground banner/handler, tap-to-navigate, background queue, and
  // token registration for every authenticated role (previously bike drivers
  // on one screen only, so autodriver pushes had no registered token).
  useEffect(() => {
    let cancelled = false;

    configureNotificationHandler();
    ensureAndroidChannel();
    registerBackgroundHandler();

    const drain = async () => {
      if (cancelled) return;
      const queued = await drainBackgroundNotifications();
      for (const item of queued) {
        handleIncoming({
          title: item.title,
          message: item.message,
          data: item.data,
          type: "push",
          created_at: new Date(item.queuedAt || Date.now()).toISOString(),
        });
      }
    };

    drain();

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const payload = toNotificationPayload(notification);
        if (!payload) return;
        handleIncoming({ ...payload.data, type: "push" });
      }
    );

    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const payload = toNotificationPayload(response?.notification);
        if (!payload) return;
        const notification = normalizeNotification({
          ...payload.data,
          type: "push",
        });
        if (!notification) return;
        handleNotificationPress(notification, navigationRef.current, roleRef.current);
      }
    );

    return () => {
      cancelled = true;
      receivedSub.remove();
      responseSub.remove();
    };
  }, [handleIncoming]);

  // Register (or re-register for a new owner / rotated token) once
  // authenticated. Passing userId matters: the Expo token is per device, so a
  // different account on the same phone has to be POSTed separately.
  useEffect(() => {
    if (!userId) return;
    registerPushToken({ userId });
  }, [userId]);
}

function normalizeNotification(data) {
  if (!data) return null;

  if (data.title && data.message) {
    const type = resolveType(data);
    return {
      id: data.id || uniqueId(),
      title: data.title,
      message: data.message,
      type,
      timestamp: data.created_at || new Date().toISOString(),
      target_screen: data.target_screen || data.metadata?.target_screen || null,
      trip_id: data.trip_id || data.metadata?.trip_id || null,
      dispatch_id: data.dispatch_id || data.metadata?.dispatch_id || null,
      raw: data,
    };
  }

  if (data.type === "new_dispatch_request") {
    const d = data.dispatch || data;
    return {
      id: d.request_id || uniqueId(),
      title: "New Ride Request",
      message: `Passenger waiting at ${d.pickup_name || d.pickup_stop_name || "nearby"}`,
      type: "info",
      timestamp: new Date().toISOString(),
      target_screen: null,
      trip_id: null,
      dispatch_id: d.request_id,
      raw: data,
    };
  }

  if (data.type === "request_accepted") {
    return {
      id: uniqueId(),
      title: "Request Accepted",
      message: data.route_name
        ? `Driver accepted for ${data.route_name}`
        : "A driver accepted your request",
      type: "success",
      timestamp: new Date().toISOString(),
      target_screen: null,
      trip_id: data.trip_id,
      dispatch_id: data.request_id,
      raw: data,
    };
  }

  if (data.type === "request_cancelled") {
    return {
      id: uniqueId(),
      title: "Request Cancelled",
      message: data.reason === "accepted_by_other"
        ? "This request was taken by another driver"
        : data.reason === "passenger_cancelled"
          ? "Passenger cancelled the request"
          : "Request has been cancelled",
      type: "warning",
      timestamp: new Date().toISOString(),
      target_screen: null,
      trip_id: null,
      dispatch_id: data.request_id,
      raw: data,
    };
  }

  if (data.type === "dispatch_update" || data.status) {
    return {
      id: uniqueId(),
      title: "Trip Update",
      message: `Trip status: ${data.status || "updated"}`,
      type: data.status === "completed" ? "success" : data.status === "cancelled" ? "warning" : "info",
      timestamp: data.updated_at || new Date().toISOString(),
      target_screen: data.status === "completed" ? null : null,
      trip_id: data.trip_id,
      dispatch_id: null,
      raw: data,
    };
  }

  return null;
}

function resolveType(data) {
  const title = (data.title || "").toLowerCase();
  if (title.includes("error") || title.includes("rejected") || title.includes("failed")) return "error";
  if (title.includes("warning") || title.includes("delay") || title.includes("cancelled")) return "warning";
  if (title.includes("accepted") || title.includes("confirmed") || title.includes("completed") || title.includes("success")) return "success";
  return data.type || "info";
}

/**
 * Tap-to-navigate.
 *
 * Priority is an explicit `target_screen` from the backend payload, then the
 * identifiers the backend actually sends today. Driver screens are chosen by
 * role: the old code always sent a driver to "FindPassenger" (the bike radar),
 * which is the wrong screen for an autodriver.
 */
function handleNotificationPress(notification, navigation, role) {
  if (!navigation) return;

  const data = notification?.raw?.data || notification?.raw?.metadata || {};
  const targetScreen =
    notification.target_screen || data.target_screen || null;
  const params = data.params && typeof data.params === "object" ? data.params : {};

  if (targetScreen) {
    navigation.navigate(targetScreen, params);
    return;
  }

  const dispatchId = notification.dispatch_id || data.dispatch_id || data.request_id;
  const tripId = notification.trip_id || data.trip_id;

  if (isDriverRole(role)) {
    const radar = role === ROLE.AUTO_DRIVER ? "AutoFindPassenger" : "FindPassenger";
    if (dispatchId) {
      navigation.navigate("DriverNavigator", {
        screen: radar,
        params: { dispatchId, ...params },
      });
      return;
    }
    // A driver tap without a dispatch id cannot reconstruct a live-trip screen
    // (those need otp/driver/vehicle params), so land on the driver home
    // rather than pushing a screen that would read undefined route params.
    navigation.navigate("DriverNavigator", { screen: "DriverTabs" });
    return;
  }

  if (tripId) {
    navigation.navigate("PassengerNavigator", {
      screen: "PassengerLiveTracking",
      params: { tripId, ...params },
    });
    return;
  }

  if (dispatchId) {
    navigation.navigate("DriverNavigator", {
      screen: "FindPassenger",
      params: { dispatchId, ...params },
    });
  }
}
