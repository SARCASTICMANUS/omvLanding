import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/client";

function getVisitorId() {
  let id = localStorage.getItem("kpi_visitor_id");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("kpi_visitor_id", id);
  }
  return id;
}

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return "mobile";
  return "desktop";
}

export default function usePageView() {
  const location = useLocation();
  const lastTracked = useRef(null);

  useEffect(() => {
    const page = location.pathname + location.search;
    if (page === lastTracked.current) return;
    lastTracked.current = page;

    api.post("/kpi/track/", {
      platform: "web",
      page,
      visitor_id: getVisitorId(),
      user_agent: navigator.userAgent,
      referrer: document.referrer || "",
      device_type: detectDeviceType(),
    }).catch(() => {});
  }, [location.pathname, location.search]);
}
