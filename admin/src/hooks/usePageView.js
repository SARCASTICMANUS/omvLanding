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
  const params = new URLSearchParams(window.location.search);
  return {
    platform: "web",
    page,
    user_agent: navigator.userAgent,
    referrer: document.referrer || "",
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_term: params.get("utm_term") || "",
    utm_content: params.get("utm_content") || "",
    device_type: detectDeviceType(),
    client_ip: clientIp || "",
  };
}

function authHeader() {
  const token = localStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// POST /api/kpi/track/ is IsAuthenticated, and sendBeacon cannot set headers
// (it also reports success regardless of the response, so a 401 would be
// invisible). Every send therefore goes through fetch with keepalive, and the
// localStorage buffer below is the fallback for when even that cannot run.
function sendViaKeepalive(payload) {
  try {
    return fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then((res) => res.ok)
      .catch(() => false);
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
  if (await sendViaKeepalive(payload)) return;
  bufferEvent(payload);
}

async function flushBufferedEvents() {
  let pending;
  try {
    pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return;
  }

  if (pending.length === 0) return;

  const eventsToSend = [...pending];
  localStorage.removeItem(STORAGE_KEY);

  for (let i = 0; i < eventsToSend.length; i++) {
    if (!(await sendViaKeepalive(eventsToSend[i]))) {
      // Stop at the first failure and re-buffer it plus everything after it,
      // so ordering is preserved and nothing is silently dropped.
      for (let j = i; j < eventsToSend.length; j++) {
        bufferEvent(eventsToSend[j]);
      }
      return;
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
