import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  LoaderCircle,
  MapPin,
  Navigation,
  Radio,
  Star,
  Timer,
  User,
  Wifi,
  X,
} from "lucide-react";
import { API_PATHS } from "../../constants/apiPaths";
import { useSocketSubscription } from "../../hooks/useSocketSubscription";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import { BottomSheet, LiveDot, ScreenHeader, StatusBadge } from "../../components/vayy";
import { buildRouteSummary } from "./driverFlowUtils";
import {
  RIDE_REQUEST_TTL_SECONDS,
  formatKm,
  isRideDismissal,
  normalizeRidePayload,
} from "./driverRideUtils";

const RIDE_REQUESTS_PATH = "/ws/tracking/ride-requests/";

const STATUS_COPY = {
  idle: "Standby",
  connecting: "Connecting…",
  open: "Live channel connected",
  closed: "Channel closed",
  error: "Channel error",
  failed: "Reconnect failed",
};

export default function DriverBuddyRadar({
  route,
  onAccept,
  onSkip,
  onBack,
}) {
  const summary = useMemo(() => buildRouteSummary(route || {}), [route]);
  const { user, token } = useSelector((state) => state.auth);
  const userId = user?.id;
  const wsToken = token || localStorage.getItem("access_token");

  const [online, setOnline] = useState(true);
  const [rides, setRides] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scanSeconds, setScanSeconds] = useState(60);
  const lastSeenRef = useRef({});
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Publish a live Redis location snapshot while this route is available for
  // hand-raises. The journey payload is returned by journeyStart and contains
  // the authoritative vehicle/trip identity.
  useDriverLocationPush({
    enabled: online && Boolean(route?.journey?.trip_id) && Boolean(route?.journey?.vehicle_id),
    vehicleId: route?.journey?.vehicle_id,
    tripId: route?.journey?.trip_id,
    vehicleType: route?.journey?.vehicle_type || route?.vehicle_type,
    vehicleNumber: route?.journey?.vehicle_number || route?.vehicle_number,
    driverId: userId,
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [80.9462, 26.8467],
      zoom: 12,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.on("load", () => map.resize());
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.resize())
      : null;
    resizeObserver?.observe(mapContainerRef.current);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          map.easeTo({ center: [coords.longitude, coords.latitude], zoom: 14, duration: 700 });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
      );
    }
    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const notificationsPath =
    userId && wsToken ? API_PATHS.sockets.passenger(userId, wsToken) : null;
  const rideRequestsPath = wsToken ? `${RIDE_REQUESTS_PATH}?token=${wsToken}` : null;

  const pushNotice = useCallback((text) => {
    setNotice(text);
    window.setTimeout(() => {
      setNotice((current) => (current === text ? null : current));
    }, 3200);
  }, []);

  const handleWsMessage = useCallback(
    (message) => {
      if (isRideDismissal(message)) {
        const dismissedId = message?.request_id || message?.trip_id;
        setRides((prev) =>
          dismissedId
            ? prev.filter(
                (ride) =>
                  ride.requestId !== String(dismissedId) &&
                  ride.tripId !== String(dismissedId),
              )
            : prev.slice(1),
        );
        pushNotice(
          message?.type === "request_expired"
            ? "Request expired"
            : "Request taken by another driver",
        );
        return;
      }

      const ride = normalizeRidePayload(message);
      if (!ride) return;

      const seenAt = lastSeenRef.current[ride.key];
      if (seenAt && Date.now() - seenAt < RIDE_REQUEST_TTL_SECONDS * 1000) return;
      lastSeenRef.current[ride.key] = Date.now();

      setRides((prev) => [...prev.filter((item) => item.key !== ride.key), ride]);
      pushNotice(`Passenger waiting at ${ride.pickup}`);
    },
    [pushNotice],
  );

  const { status: notificationsStatus } = useSocketSubscription({
    key: userId ? `driver-radar-notify-${userId}` : null,
    path: online ? notificationsPath : null,
    enabled: !!userId && !!wsToken && online,
    onMessage: handleWsMessage,
  });

  const { status: requestsStatus } = useSocketSubscription({
    key: userId ? `driver-radar-requests-${userId}` : null,
    path: online ? rideRequestsPath : null,
    enabled: !!userId && !!wsToken && online,
    onMessage: handleWsMessage,
  });

  useEffect(() => {
    const timerId = window.setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      setScanSeconds((prev) => (prev <= 1 ? 60 : prev - 1));
      setRides((prev) =>
        prev.filter((ride) => now - ride.receivedAt < RIDE_REQUEST_TTL_SECONDS * 1000),
      );
    }, 1000);
    return () => window.clearInterval(timerId);
  }, []);

  const activeRides = rides.filter(
    (ride) => nowTick - ride.receivedAt < RIDE_REQUEST_TTL_SECONDS * 1000,
  );
  const currentRide = activeRides[0] || null;
  const remaining = currentRide
    ? Math.max(0, RIDE_REQUEST_TTL_SECONDS - Math.round((nowTick - currentRide.receivedAt) / 1000))
    : 0;

  const connectionStatus = !online
    ? "idle"
    : notificationsStatus === "open" || requestsStatus === "open"
      ? "open"
      : notificationsStatus === "failed" || requestsStatus === "failed"
        ? "failed"
        : notificationsStatus === "connecting" || requestsStatus === "connecting"
          ? "connecting"
          : notificationsStatus === "error" || requestsStatus === "error"
            ? "error"
            : notificationsStatus || requestsStatus;

  const removeRide = (ride) =>
    setRides((prev) => prev.filter((item) => item.key !== ride.key));

  const handleAccept = async () => {
    if (!currentRide || busy) return;
    setBusy(true);
    try {
      const result = await onAccept(currentRide);
      if (result?.ok) {
        removeRide(currentRide);
      } else {
        pushNotice(result?.error || "Could not accept this request");
        removeRide(currentRide);
      }
    } catch {
      pushNotice("Could not accept this request");
      removeRide(currentRide);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = () => {
    if (!currentRide || busy) return;
    removeRide(currentRide);
    onSkip?.(currentRide);
  };

  const connectionLabel = online
    ? STATUS_COPY[connectionStatus] || "Connecting…"
    : "You are offline";
  const connectionTone =
    !online || connectionStatus === "failed" || connectionStatus === "error"
      ? "err"
      : connectionStatus === "open"
        ? "live"
        : "off";

  const scanning = online && !currentRide;

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-[#F8FAF9] ${
        currentRide ? "pb-[420px]" : "pb-[130px]"
      }`}
    >
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" aria-hidden="true" />
      <div className="relative z-10 mx-auto w-full max-w-[560px] px-4 pt-4 sm:px-6 lg:max-w-[720px]">
        <ScreenHeader
          title="Buddy Radar"
          subtitle={summary.title}
          onBack={onBack}
          right={
            <button
              type="button"
              onClick={() => setOnline((prev) => !prev)}
              aria-label={online ? "Go offline" : "Go online"}
              title={online ? "Go offline" : "Go online"}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                online
                  ? "bg-[#009849] text-white shadow-[0_4px_12px_rgba(0,152,73,0.3)] hover:bg-[#007A3B]"
                  : "border border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#009849]"
              }`}
            >
              <Radio size={20} strokeWidth={2.2} />
            </button>
          }
        />

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={
              connectionTone === "live"
                ? "live"
                : connectionTone === "err"
                  ? "error"
                  : "neutral"
            }
          >
            <span
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                connectionTone === "live"
                  ? "bg-[#009849]"
                  : connectionTone === "err"
                    ? "bg-[#EF4444]"
                    : "bg-[#9CA3AF]"
              }`}
            />
            {connectionLabel}
          </StatusBadge>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[11px] font-extrabold text-[#6B7280] shadow-sm backdrop-blur-md">
            <MapPin size={12} />
            {summary.startLabel} → {summary.endLabel}
          </span>
          {online && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BBF7D0]/80 bg-[#F0FDF4]/85 px-2.5 py-1 text-[11px] font-extrabold text-[#15803D] shadow-sm backdrop-blur-md">
              <Wifi size={12} />
              Ride channel listening
            </span>
          )}
        </div>

        {notice && (
          <div className="mt-3 flex items-center gap-2 rounded-v-md border border-[#E5E7EB] bg-white px-4 py-3 shadow-v-sm">
            <LiveDot size={8} />
            <p className="text-[13px] font-bold text-[#374151]">{notice}</p>
          </div>
        )}

        {/* Radar card — replica of the mobile scanning visual */}
        <section className="mt-4 rounded-vayy border border-white/75 bg-white/88 px-4 py-6 shadow-v-sm backdrop-blur-xl sm:px-5">
          <div className="relative mx-auto flex h-[220px] w-[220px] max-w-full items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,rgba(0,152,73,0.16)_0%,rgba(0,152,73,0.04)_45%,transparent_70%)]">
            <span
              className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(0,230,118,0)_0deg,rgba(0,230,118,0)_300deg,rgba(0,230,118,0.5)_360deg)] animate-spin"
              style={{ animationDuration: "3s" }}
              aria-hidden="true"
            />
            <span className="absolute h-[200px] w-[200px] rounded-full border-[1.5px] border-dashed border-[#009849]/30" />
            <span className="absolute h-[132px] w-[132px] rounded-full border-[1.5px] border-dashed border-[#009849]/30" />
            <span className="absolute h-16 w-16 rounded-full border border-[#009849]/40 bg-[#009849]/10" />

            {scanning && (
              <>
                <span
                  className="absolute h-[200px] w-[200px] animate-ping rounded-full border-[1.5px] border-[#00E676]/25"
                  style={{ animationDuration: "1.8s" }}
                />
                <span
                  className="absolute h-[132px] w-[132px] animate-ping rounded-full border-[1.5px] border-[#00E676]/25"
                  style={{ animationDuration: "1.8s", animationDelay: "0.6s" }}
                />
                <span
                  className="absolute h-16 w-16 animate-ping rounded-full border-[1.5px] border-[#00E676]/40"
                  style={{ animationDuration: "1.8s", animationDelay: "1.2s" }}
                />
              </>
            )}

            {currentRide && (
              <span
                className="absolute h-2.5 w-2.5 animate-pulse rounded-full bg-[#00E676] shadow-[0_0_12px_rgba(0,230,118,0.9)]"
                style={{ top: "32%", left: "64%" }}
              />
            )}

            {scanning && (
              <span className="absolute left-1/2 top-[42%] z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-v-md bg-white px-4 py-2.5 text-[13px] font-bold text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                <LiveDot size={8} />
                Scanning nearby area…
              </span>
            )}

            {currentRide && (
              <span className="absolute left-1/2 top-[42%] z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-v-md bg-[#ECFAF1] px-4 py-2.5 text-[13px] font-bold text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
                <User size={14} className="text-[#009849]" />
                Buddy found!
              </span>
            )}

            {!online && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-full bg-[#0F2A42]/95 px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <Radio size={30} className="text-white/25" />
                </span>
                <p className="mt-3 text-[18px] font-extrabold text-white">
                  Radar Offline
                </p>
                <p className="mt-1 text-[13px] font-medium text-white/40">
                  Tap the radio icon to start
                </p>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-[13px] font-medium text-[#9CA3AF]">
            {!online
              ? "Go online to receive ride requests on this route."
              : currentRide
                ? `${currentRide.name} is waiting for a ride`
                : "Waiting for nearby passenger requests"}
          </p>

          {/* Scan timer */}
          <div className="mt-4 rounded-v-md bg-[#F9FAFB] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-extrabold uppercase tracking-widest text-[#94A3B8]">
                Scanning for buddies
              </span>
              <span className="text-[13px] font-extrabold text-[#009849]">
                {scanning ? `${scanSeconds}s` : "Paused"}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#009849] transition-[width] duration-1000 ease-linear"
                style={{ width: `${scanning ? (scanSeconds / 60) * 100 : 0}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Ride request bottom sheet — replica of the mobile buddy popup */}
      {currentRide && (
        <BottomSheet>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#009849] text-[15px] font-black text-white">
              {currentRide.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-extrabold text-[#111827]">
                {currentRide.name}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-[#374151]">
                <Star size={12} className="fill-[#FFB800] text-[#FFB800]" />
                {currentRide.rating || "—"}
                <span className="px-1 text-[#D1D5DB]">|</span>
                <span className="text-[12px] font-medium text-[#9CA3AF]">
                  {currentRide.trips} trips
                </span>
              </p>
            </div>
            <span className="shrink-0 rounded-v-md bg-[#ECFAF1] px-3.5 py-2 text-center">
              <span className="block text-[19px] font-black leading-none text-[#009849]">
                {currentRide.fareAmount != null ? `\u20B9${currentRide.fareAmount}` : "—"}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold text-[#009849]">
                est.
              </span>
            </span>
          </div>

          {/* Request expiry */}
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div
                className="h-full rounded-full bg-[#EF4444] transition-[width] duration-1000 ease-linear"
                style={{ width: `${(remaining / RIDE_REQUEST_TTL_SECONDS) * 100}%` }}
              />
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-extrabold text-[#EF4444]">
              <Timer size={12} />
              {remaining}s
            </span>
          </div>

          {/* Route card */}
          <div className="mt-4 flex gap-2.5 rounded-[16px] bg-[#F9FAFB] p-3.5">
            <div className="flex w-3 shrink-0 flex-col items-center pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#009849]" />
              <span className="my-1 w-0.5 flex-1 rounded bg-[#D1D5DB]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3px] text-[#9CA3AF]">
                  From
                </p>
                <p className="mt-0.5 truncate text-[14px] font-bold text-[#111827]">
                  {currentRide.pickup || "Pickup"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.3px] text-[#9CA3AF]">
                  To
                </p>
                <p className="mt-0.5 truncate text-[14px] font-bold text-[#111827]">
                  {currentRide.drop || "Destination"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-[8px] bg-[#ECFAF1] px-2 py-1 text-[12px] font-bold text-[#009849]">
                <Navigation size={12} />
                {currentRide.distanceKm != null ? formatKm(currentRide.distanceKm) : "—"}
              </span>
              <span className="text-[12px] font-semibold text-[#6B7280]">
                {currentRide.eta != null ? `${currentRide.eta} min` : "—"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSkip}
              disabled={busy}
              className="flex h-14 flex-1 items-center justify-center gap-1.5 rounded-vayy border border-[#FECACA] bg-[#FEF2F2] text-[15px] font-bold text-[#EF4444] transition hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={18} strokeWidth={2.4} />
              Skip
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              className="flex h-14 flex-[1.5] items-center justify-center gap-2 rounded-vayy bg-[#009849] text-[16px] font-extrabold text-white shadow-[0_4px_14px_rgba(0,152,73,0.35)] transition hover:bg-[#007A3B] disabled:cursor-not-allowed disabled:bg-[#D1D5DB] disabled:shadow-none"
            >
              {busy ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  Accepting…
                </>
              ) : (
                <>
                  <Navigation size={18} strokeWidth={2.4} />
                  Accept Ride
                </>
              )}
            </button>
          </div>

          {activeRides.length > 1 && (
            <p className="mt-3 text-center text-[12px] font-bold text-[#9CA3AF]">
              {activeRides.length - 1} more request{activeRides.length > 2 ? "s" : ""} waiting
            </p>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
