import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return "mobile";
  return "desktop";
}

export default function usePageView() {
  const location = useLocation();

  useEffect(() => {
    const page = location.pathname + location.search;

    api.post("/kpi/track/", {
      platform: "web",
      page,
      user_agent: navigator.userAgent,
      referrer: document.referrer || "",
      device_type: detectDeviceType(),
    }).catch(() => {});
  }, [location.pathname, location.search]);
}
