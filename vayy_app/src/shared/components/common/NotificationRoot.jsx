import React, { useRef } from "react";
import NotificationToast from "./NotificationToast";
import useNotificationListener from "../../hooks/useNotificationListener";

export default function NotificationRoot() {
  const toastRef = useRef(null);
  useNotificationListener(toastRef);
  return <NotificationToast ref={toastRef} />;
}
