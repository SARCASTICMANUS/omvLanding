import { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import socketManager from "../lib/socketManager";
import { WS } from "../../constants";
import { addNotification } from "../../store/slices/notificationSlice";

let _idCounter = 0;
function uniqueId() {
  _idCounter += 1;
  return `ntf_${Date.now()}_${_idCounter}`;
}

export default function useNotificationListener(toastRef) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { user } = useSelector((state) => state.auth);
  const userId = user?.id;
  const navigationRef = useRef(navigation);

  useEffect(() => {
    navigationRef.current = navigation;
  }, [navigation]);

  useEffect(() => {
    if (!userId) return;

    const wsPath = WS.notifications(userId);

    const unsub = socketManager.subscribe(wsPath, {
      onMessage: (data) => {
        const notification = normalizeNotification(data);
        if (!notification) return;

        dispatch(addNotification(notification));

        toastRef.current?.show({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          timestamp: notification.timestamp,
          onPress: () => handleNotificationPress(notification, navigationRef.current),
        });
      },
    });

    return unsub;
  }, [userId, dispatch]);
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

function handleNotificationPress(notification, navigation) {
  if (!navigation) return;

  if (notification.trip_id) {
    navigation.navigate("PassengerNavigator", {
      screen: "PassengerLiveTracking",
      params: { tripId: notification.trip_id },
    });
    return;
  }

  if (notification.dispatch_id) {
    navigation.navigate("DriverNavigator", {
      screen: "FindPassenger",
      params: { dispatchId: notification.dispatch_id },
    });
    return;
  }
}
