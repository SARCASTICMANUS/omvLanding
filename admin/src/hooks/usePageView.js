import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE } from "../api/client";

const STORAGE_KEY = "pending_analytics_events";
const IP_CACHE_KEY = "vayy_client_ip";
const MAX_BUFFERED = 50;
const TRACK_URL = `${API_BASE}/kpi/track/`;

// ─── Helpers ────────────────────────────────────────────

function detectDeviceType() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return "mobile";
  return "desktop";
}

function getClientIp() {
  const cached = localStorage.getItem(IP_CACHE_KEY);
  if (cached) return Promise.resolve(cached);

  return fetch("https://api.ipify.org?format=json")
    .then((res) => res.json())
    .then((data) => {
      const ip = data.ip || "";
      if (ip) localStorage.setItem(IP_CACHE_KEY, ip);
      return ip;
    })
    .catch(() => "");
}

function buildPayload(page, clientIp) {
  return {
    platform: "web",
    page,
    user_agent: navigator.userAgent,
    referrer: document.referrer || "",
    device_type: detectDeviceType(),
    client_ip: clientIp || "",
  };
}

function sendViaBeacon(payload) {
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json",
    });
    return navigator.sendBeacon(TRACK_URL, blob);
  } catch {
    return false;
  }
}

function sendViaKeepalive(payload) {
  try {
    return fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).then(() => true).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

// ─── LocalStorage buffer ────────────────────────────────

function bufferEvent(payload) {
  try {
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (pending.length >= MAX_BUFFERED) pending.shift();
    pending.push(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // localStorage full or unavailable — drop silently
  }
}

async function sendOrBuffer(payload) {
  const sent = await sendViaBeacon(payload);
  if (sent) return;

  const keepaliveOk = await sendViaKeepalive(payload);
  if (keepaliveOk) return;

  bufferEvent(payload);
}

function flushBufferedEvents() {
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return;
  }

  if (pending.length === 0) return;

  const eventsToSend = [...pending];
  localStorage.removeItem(STORAGE_KEY);

  for (const event of eventsToSend) {
    const sent = sendViaBeacon(event);
    if (!sent) {
      sendViaKeepalive(event).then((ok) => {
        if (!ok) bufferEvent(event);
      });
      // Re-buffer remaining events for later flush
      for (let i = eventsToSend.indexOf(event) + 1; i < eventsToSend.length; i++) {
        bufferEvent(eventsToSend[i]);
      }
      break;
    }
  }
}

// ─── Hook ───────────────────────────────────────────────

export default function usePageView() {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    getClientIp().then((clientIp) => {
      if (cancelled) return;

      const page = location.pathname + location.search;
      const payload = buildPayload(page, clientIp);
      sendOrBuffer(payload);
    });

    return () => { cancelled = true; };
  }, [location.pathname, location.search]);

  // Listen for custom "kpitrack" events (tab changes in AdminLayout)
  useEffect(() => {
    const handleCustomTrack = (e) => {
      const page = e.detail?.page;
      if (!page) return;
      getClientIp().then((clientIp) => {
        const payload = buildPayload(page, clientIp);
        sendOrBuffer(payload);
      });
    };
    window.addEventListener("kpitrack", handleCustomTrack);
    return () => window.removeEventListener("kpitrack", handleCustomTrack);
  }, []);

  // Flush on page show (back/forward navigation)
  useEffect(() => {
    const handlePageShow = () => flushBufferedEvents();
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // Flush when tab is hidden (user switching tabs or leaving)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushBufferedEvents();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Flush when browser comes back online
  useEffect(() => {
    const handleOnline = () => flushBufferedEvents();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);
}
