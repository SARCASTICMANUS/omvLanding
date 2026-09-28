import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { VayyCard } from "../components/vayy";
import api from "../lib/api";
import { API_PATHS } from "../constants/apiPaths";
import { useSocketSubscription } from "../hooks/useSocketSubscription";
import {
  clearPassengerNotifications,
  pushPassengerNotification,
} from "../redux/slices/passengerSlice";

// Sample alerts used only when the notification API is unreachable
// (mirrors DUMMY_ALERTS in vayy_app PassengerAlertsScreen).
// Timestamps are computed once at module load so render stays pure.
const MOCK_ALERTS = [
  {
    id: "mock-1",
    title: "System Update",
    message:
      "Multi-city transit maps have been updated with new active routes.",
    notification_type: "in_app",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "mock-2",
    title: "Kalman Smoothing",
    message:
      "GPS smoothing has been upgraded to Kalman Filter v2 for lower jitter.",
    notification_type: "in_app",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "mock-3",
    title: "Safety Shield Active",
    message: "OMV Safe-Trip monitoring is fully active for all live rides.",
    notification_type: "success",
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const formatRelativeTime = (value, now) => {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";

  const diffMs = now - time;
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
};

const getType = (item) => item?.notification_type || item?.type || "info";

const isRead = (item, readIds, allRead) =>
  allRead || item?.read === true || item?.is_read === true || readIds[item.id];

// getAlertColor() parity with vayy_app PassengerAlertsScreen:
// warning / error / info keep the mobile hex values.
const ALERT_ACCENTS = {
  success: { dot: "bg-[#009849]", title: "text-[#009849]" },
  warning: { dot: "bg-[#F59E0B]", title: "text-[#F59E0B]" },
  error: { dot: "bg-[#EF4444]", title: "text-[#EF4444]" },
  info: { dot: "bg-[#378ADD]", title: "text-[#378ADD]" },
};

const getAlertColor = (type) => ALERT_ACCENTS[type] || ALERT_ACCENTS.info;

export default function NotificationsPage() {
  const dispatch = useDispatch();
  const { user, token, isAuthenticated } = useSelector(
    (state) => state.auth || {},
  );
  const liveNotifications = useSelector(
    (state) => state.passenger?.notifications || [],
  );

  const [history, setHistory] = useState([]);
  const [liveWs, setLiveWs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [readIds, setReadIds] = useState({});
  const [allRead, setAllRead] = useState(false);
  const [working, setWorking] = useState(false);
  const [fallbackUserId, setFallbackUserId] = useState(null);
  // Fixed once per mount so relative timestamps render deterministically.
  const [now] = useState(() => Date.now());
  const meRan = useRef(false);

  const accessToken = token || localStorage.getItem("access_token");
  const userId = user?.id || fallbackUserId;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get(API_PATHS.communication.notifications);
      const payload = response.data?.data ?? response.data;
      setHistory(unwrapList(payload));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Pre-existing sessions can hold a user object without an id → resolve it once.
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

  const syncBadge = useCallback(
    (items) => {
      dispatch(clearPassengerNotifications());
      items
        .filter((item) => !isRead(item, {}, false))
        .forEach((item) => dispatch(pushPassengerNotification(item)));
    },
    [dispatch],
  );

  const handleWsMessage = useCallback((message) => {
    if (!message || typeof message !== "object") return;
    setLiveWs((previous) => {
      if (previous.some((item) => String(item.id) === String(message.id))) {
        return previous;
      }
      return [{ ...message, createdAt: Date.now() }, ...previous].slice(0, 50);
    });
  }, []);

  useSocketSubscription({
    key: userId ? `notifications-${userId}` : null,
    path: userId
      ? API_PATHS.sockets.passenger(userId, accessToken)
      : null,
    enabled: !!userId && !!accessToken,
    onMessage: handleWsMessage,
  });

  const notifications = useMemo(() => {
    const merged = [...history, ...liveWs, ...liveNotifications];
    const seen = new Set();
    const deduped = [];

    merged.forEach((item) => {
      const id = String(item?.id ?? `${item?.title}-${item?.created_at}`);
      if (seen.has(id)) return;
      seen.add(id);
      deduped.push({ ...item, id: item?.id ?? id });
    });

    return deduped.sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || 0).getTime() || 0;
      const timeB = new Date(b.created_at || b.createdAt || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [history, liveWs, liveNotifications]);

  const unreadCount = useMemo(
    () =>
      notifications.filter((item) => !isRead(item, readIds, allRead)).length,
    [notifications, readIds, allRead],
  );

  const usingMocks = error && notifications.length === 0;
  const visible = usingMocks ? MOCK_ALERTS : notifications;

  useEffect(() => {
    if (loading || error || history.length === 0) return;
    syncBadge(notifications);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, history.length]);

  const handleMarkRead = async (item) => {
    if (isRead(item, readIds, allRead)) return;

    if (String(item.id).startsWith("mock-")) {
      setReadIds((previous) => ({ ...previous, [item.id]: true }));
      return;
    }

    setActionError("");
    try {
      await api.patch(API_PATHS.communication.notificationRead(item.id));
      const updated = { ...item, read: true };
      setReadIds((previous) => ({ ...previous, [item.id]: true }));
      setHistory((previous) =>
        previous.map((entry) =>
          String(entry.id) === String(item.id) ? updated : entry,
        ),
      );
      setLiveWs((previous) =>
        previous.map((entry) =>
          String(entry.id) === String(item.id) ? updated : entry,
        ),
      );
      syncBadge(
        notifications.map((entry) =>
          String(entry.id) === String(item.id) ? updated : entry,
        ),
      );
    } catch {
      setActionError("Couldn't mark that alert as read. Try again.");
    }
  };

  const handleMarkAllRead = async () => {
    if (working || unreadCount === 0) return;
    setWorking(true);
    setActionError("");
    try {
      await api.patch(API_PATHS.communication.notificationReadAll);
      setAllRead(true);
      dispatch(clearPassengerNotifications());
    } catch {
      setActionError("Couldn't mark all alerts as read. Try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-canvas font-sans pb-6">
      <div className="mx-auto w-full max-w-2xl px-4 pt-6 lg:max-w-3xl lg:pt-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[28px] font-black leading-tight text-[#111827]">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#009849] px-2 text-xs font-extrabold text-white">
                {unreadCount}
              </span>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={working}
              className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-bold text-[#009849] transition-colors hover:bg-[#E0F5E8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849] disabled:opacity-60"
            >
              {working ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCheck size={13} />
              )}
              Mark all read
            </button>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#EF4444]"
          >
            {actionError}
          </div>
        )}

        {error && !usingMocks && (
          <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-sm font-medium text-[#92400E]">
            <div className="flex items-center justify-between gap-3">
              <span>Couldn&apos;t reach the notification service.</span>
              <button
                type="button"
                onClick={fetchHistory}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#FDE68A] bg-white px-3 py-1.5 text-xs font-bold text-[#92400E] transition-colors hover:bg-[#FEF3C7]"
              >
                <RefreshCw size={12} />
                Retry
              </button>
            </div>
          </div>
        )}

        {usingMocks && (
          <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3 text-xs font-semibold text-[#92400E]">
            Showing sample alerts while notifications are unavailable.
          </div>
        )}

        {loading && history.length === 0 && !usingMocks ? (
          <div className="flex flex-col items-center justify-center py-24 text-[#9CA3AF]">
            <Loader2 size={32} className="animate-spin text-[#009849]" />
            <p className="mt-4 text-sm font-semibold">Loading notifications…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-16 text-center">
            <p className="text-[15px] text-[#6B7280]">No new alerts</p>
            <p className="text-[13px] text-[#6B7280]">
              Your notifications will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((alert) => {
              const accent = getAlertColor(getType(alert));
              const read = isRead(alert, readIds, allRead);
              return (
                <button
                  key={String(alert.id)}
                  type="button"
                  onClick={() => handleMarkRead(alert)}
                  disabled={read}
                  className="block w-full rounded-vayy text-left transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#009849] disabled:cursor-default disabled:hover:opacity-100"
                >
                  <VayyCard>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center">
                        {!read && (
                          <span
                            aria-hidden="true"
                            className={`mr-1.5 h-2 w-2 shrink-0 rounded-full ${accent.dot}`}
                          />
                        )}
                        <h3
                          className={`min-w-0 flex-1 text-base ${
                            read
                              ? "font-semibold text-[#374151]"
                              : `font-extrabold ${accent.title}`
                          }`}
                        >
                          {alert.title || "Notification"}
                        </h3>
                      </div>
                      <span className="shrink-0 text-xs text-[#6B7280]">
                        {formatRelativeTime(
                          alert.created_at || alert.createdAt,
                          now,
                        )}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-sm leading-5 text-[#374151] ${
                        read ? "opacity-75" : ""
                      }`}
                    >
                      {alert.message || alert.body}
                    </p>
                  </VayyCard>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
