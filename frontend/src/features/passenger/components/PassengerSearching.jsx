import React, { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronLeft, Clock3, RefreshCw, Search, X } from "lucide-react";
import { LiveDot, SheetHandle } from "../../../components/vayy";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import { useSocketSubscription } from "../../../hooks/useSocketSubscription";
import userTopImg from "../../../assets/VayyUserTop.webp";
import bikeFrontImg from "../../../assets/vayyFrontBike.webp";

const SEARCH_TIMEOUT_MS = 60000;
const SEARCH_TIMEOUT_SEC = SEARCH_TIMEOUT_MS / 1000;

function getAccessToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("access_token");
}

function stopName(stop, fallback) {
  return stop?.name || fallback?.name || fallback?.display_name || "--";
}

export default function PassengerSearching({
  selectedTrip,
  pickup,
  destination,
  onMatched,
  onBack,
}) {
  const [attempt, setAttempt] = useState(0);
  const [phaseState, setPhase] = useState("requesting");
  const [requestId, setRequestId] = useState(null);
  const [driversNotified, setDriversNotified] = useState(null);
  const [errorState, setErrorMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [showNoRide, setShowNoRide] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const matchedRef = useRef(false);
  const onMatchedRef = useRef(onMatched);

  useEffect(() => {
    onMatchedRef.current = onMatched;
  }, [onMatched]);

  const targetTripId = selectedTrip?.trip_id || selectedTrip?.id;
  const routeId = selectedTrip?.route_id || null;
  const pickupStopId = selectedTrip?.pickup_stop?.id || selectedTrip?.pickup_stop?.stop_id;
  const dropStopId = selectedTrip?.dropoff_stop?.id || selectedTrip?.dropoff_stop?.stop_id;
  const invalidRequest = !targetTripId || !pickupStopId || !dropStopId;
  const phase = invalidRequest ? "error" : phaseState;
  const errorMessage = invalidRequest
    ? "Missing route or pickup details. Go back and pick your stops again."
    : errorState;

  const handleMatched = useCallback((payload) => {
    if (matchedRef.current) return;
    matchedRef.current = true;
    onMatchedRef.current?.(payload);
  }, []);

  useEffect(() => {
    if (invalidRequest) return undefined;
    let alive = true;
    matchedRef.current = false;

    (async () => {
      try {
        const response = await api.post(API_PATHS.operations.dispatchRequest, {
          route_id: routeId,
          target_trip_id: targetTripId,
          pickup_stop_id: pickupStopId,
          drop_stop_id: dropStopId || undefined,
          mode: "broadcast",
        });
        if (!alive) return;

        const payload = response.data || {};
        if (payload.status === "no_drivers_available") {
          setPhase("no_drivers");
          return;
        }

        const directTripId = payload.trip_id || payload.id;
        if (directTripId) {
          handleMatched(payload);
          return;
        }

        if (payload.request_id) {
          setRequestId(payload.request_id);
          setDriversNotified(payload.drivers_notified ?? null);
          setPhase("searching");
          return;
        }

        setPhase("error");
        setErrorMessage(payload.message || "We couldn't reach the dispatch service.");
      } catch (error) {
        if (!alive) return;
        setPhase("error");
        setErrorMessage(
          error?.response?.data?.message ||
            error?.response?.data?.detail ||
            "We couldn't reach the dispatch service.",
        );
      }
    })();

    return () => {
      alive = false;
    };
  }, [attempt, routeId, targetTripId, pickupStopId, dropStopId, invalidRequest, handleMatched]);

  useEffect(() => {
    if (phase !== "searching" || !requestId) return undefined;

    const tick = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    const fallback = setTimeout(() => {
      api
        .post(`/api/operations/dispatch/broadcast/${requestId}/cancel/`)
        .catch(() => null)
        .finally(() => {
          if (matchedRef.current) return;
          setPhase("no_drivers");
        });
    }, SEARCH_TIMEOUT_MS);

    return () => {
      clearInterval(tick);
      clearTimeout(fallback);
    };
  }, [phase, requestId]);

  const { status: socketStatus } = useSocketSubscription({
    key: `passenger-dispatch-broadcast-${requestId}`,
    path: requestId ? `/ws/dispatch/broadcast/${requestId}/?token=${getAccessToken()}` : null,
    enabled: Boolean(requestId) && phase === "searching",
    onMessage: (message) => {
      if (!message || matchedRef.current) return;
      if (message.type === "request_accepted" && message.trip_id) {
        handleMatched(message);
        return;
      }
      if (message.type === "no_drivers_available") {
        setPhase("no_drivers");
      }
    },
  });

  const handleCancel = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      if (requestId) {
        await api.post(`/api/operations/dispatch/broadcast/${requestId}/cancel/`);
      }
      onBack?.();
    } catch {
      setErrorMessage("We couldn't cancel the request. Please try again.");
      setPhase("error");
      setCancelling(false);
    }
  }, [requestId, onBack, cancelling]);

  const handleRetry = useCallback(() => {
    matchedRef.current = false;
    setPhase("requesting");
    setRequestId(null);
    setDriversNotified(null);
    setErrorMessage("");
    setElapsed(0);
    setShowNoRide(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    setShowNoRide(phase === "no_drivers");
  }, [phase]);

  const rideMode = (selectedTrip?.vehicle_type || "ride").toString().toLowerCase();
  const waitMinutes = Math.max(1, Math.ceil((selectedTrip?.eta_seconds || 300) / 60));
  const pickupPoint = selectedTrip?.pickup_stop || pickup;
  const progressPct = Math.min(100, (elapsed / SEARCH_TIMEOUT_SEC) * 100);

  const headerTitle =
    phase === "requesting"
      ? "Getting Location..."
      : phase === "no_drivers"
        ? "No Marshal Found"
        : phase === "error"
          ? "Search Stopped"
          : "Finding Marshal...";

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const centerLng = pickupPoint?.lon;
  const centerLat = pickupPoint?.lat;

  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return undefined;
    const center =
      Number.isFinite(centerLng) && Number.isFinite(centerLat)
        ? [centerLng, centerLat]
        : [80.9462, 26.8467];
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center,
      zoom: 15,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [centerLng, centerLat]);

  const searching = phase === "searching" || phase === "requesting";

  return (
    <div className="fixed inset-0 z-[500] flex flex-col overflow-hidden bg-vayy-canvas font-sans">
      {/* Map area with searching pulse */}
      <div className="absolute inset-0 bg-[#E7ECEF]">
        <div ref={mapContainer} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="relative flex h-[104px] w-[104px] items-center justify-center">
            <span
              className={`absolute h-20 w-20 rounded-full border-2 border-[#009849] bg-[#009849]/10 ${
                searching ? "animate-ping" : ""
              } [animation-duration:2000ms]`}
            />
            <span
              className={`absolute h-20 w-20 rounded-full border-2 border-[#009849] bg-[#009849]/10 ${
                searching ? "animate-ping" : ""
              } [animation-delay:660ms] [animation-duration:2000ms]`}
            />
            <span
              className={`absolute h-20 w-20 rounded-full border-2 border-[#009849] bg-[#009849]/10 ${
                searching ? "animate-ping" : ""
              } [animation-delay:1320ms] [animation-duration:2000ms]`}
            />
            <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_6px_18px_rgba(0,0,0,0.22)]">
              <img src={userTopImg} alt="" className="h-full w-full object-contain" />
            </span>
          </div>
        </div>

        {/* Green gradient header */}
        <header className="absolute inset-x-0 top-0 z-20 overflow-hidden bg-[#009849] px-5 pb-3 pt-4 shadow-[0_4px_18px_rgba(0,152,73,0.25)]">
          <span className="pointer-events-none absolute -right-10 -top-16 h-[190%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="pointer-events-none absolute -right-6 -top-24 h-[170%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
          <div className="relative mx-auto flex w-full max-w-[720px] items-center gap-4">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              aria-label="Go back"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_10px_rgba(0,0,0,0.12)] transition active:scale-95 disabled:opacity-50"
            >
              <ChevronLeft size={24} strokeWidth={2.6} />
            </button>
            <h1 className="text-[22px] font-extrabold tracking-[-0.5px] text-white">{headerTitle}</h1>
          </div>
        </header>
      </div>

      {/* Bottom sheet */}
      <div className="absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[78vh] w-full max-w-[560px] overflow-y-auto rounded-t-[32px] bg-white px-6 pb-6 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.10)] lg:max-w-[720px]">
        <SheetHandle />

        <div className="mb-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#9CA3AF]">
            Selected Route
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#009849]" />
            <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-[#111827]">
              {stopName(selectedTrip?.pickup_stop, pickup)} &rarr;{" "}
              {stopName(selectedTrip?.dropoff_stop, destination)}
            </p>
            <span className="shrink-0 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#6B7280]">
              {rideMode}
            </span>
          </div>
        </div>

        {/* Availability row */}
        <div className="mb-5 flex items-center justify-center gap-4 rounded-[16px] bg-[#ECFAF1] px-4 py-3">
          <span className="flex items-center gap-1.5">
            <img src={bikeFrontImg} alt="" className="h-[18px] w-[18px] object-contain" />
            <span className="text-[13px] font-medium text-[#374151]">
              <span className="font-extrabold text-[#009849]">{driversNotified ?? "--"}</span>{" "}
              Marshals nearby
            </span>
          </span>
          <span className="h-5 w-px bg-[#A7F3C4]" />
          <span className="flex items-center gap-1.5">
            <Clock3 size={18} className="text-[#009849]" />
            <span className="text-[13px] font-medium text-[#374151]">
              <span className="font-extrabold text-[#009849]">{waitMinutes} min</span> avg. wait
            </span>
          </span>
        </div>

        {phase === "requesting" ? (
          <div className="mb-6 text-center">
            <p className="text-[18px] font-extrabold text-[#111827]">Raising your hand...</p>
            <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
              Letting nearby Marshals know you are waiting
            </p>
          </div>
        ) : null}

        {phase === "searching" ? (
          <>
            <div className="mb-5 text-center">
              <p className="text-[18px] font-extrabold text-[#111827]">
                Searching for nearby Marshals...
              </p>
              <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
                Your location has been shared with nearby Marshals
              </p>
            </div>

            <div className="mb-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-[#9CA3AF]">
                <span>Searching</span>
                <span>
                  {elapsed}s / {SEARCH_TIMEOUT_SEC}s
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5E7EB]">
                <div
                  className="h-full rounded-full bg-[#009849] transition-all duration-1000 ease-linear"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="flex h-[60px] w-full items-center justify-center rounded-[20px] bg-[#009849]/40 text-[18px] font-extrabold text-white">
              <span aria-hidden="true">&#9995;</span>&nbsp;&nbsp; Hand Raised
            </div>

            <p className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-[#009849]">
              <LiveDot size={8} />
              {socketStatus === "open" ? "Connected to dispatch" : "Connecting to dispatch"}
            </p>
          </>
        ) : null}

        {phase === "no_drivers" ? (
          <div className="mb-4 text-center">
            <p className="text-[18px] font-extrabold text-[#111827]">No Marshals Found</p>
            <p className="mt-1 text-[13px] font-medium text-[#6B7280]">
              We couldn't find any nearby Marshals. Please try again.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 h-14 w-full rounded-[18px] bg-[#009849] text-[17px] font-extrabold text-white shadow-[0_4px_12px_rgba(0,152,73,0.3)] transition hover:bg-[#007A3B] active:scale-[0.99]"
            >
              Try Again
            </button>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="mb-4 text-center">
            <p className="text-[18px] font-extrabold text-[#111827]">Something went wrong</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] font-medium text-[#6B7280]">
              {errorMessage}
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRetry}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#009849] text-[17px] font-extrabold text-white transition hover:bg-[#007A3B] active:scale-[0.99]"
              >
                <RefreshCw size={18} /> Retry
              </button>
              <button
                type="button"
                onClick={onBack}
                className="h-12 w-full rounded-[18px] bg-[#F3F4F6] text-[15px] font-bold text-[#6B7280] transition hover:bg-[#E5E7EB]"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : null}

        {phase === "searching" || phase === "no_drivers" ? (
          <button
            type="button"
            onClick={() => setShowCancelConfirm(true)}
            className="mt-4 w-full py-1 text-center text-[14px] font-bold text-[#EF4444] transition hover:underline"
          >
            Cancel Request
          </button>
        ) : null}
      </div>

      {/* No ride found popup */}
      {showNoRide ? (
        <div
          className="fixed inset-0 z-[1350] flex items-center justify-center bg-black/40 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="No Marshals Found"
        >
          <div className="w-full max-w-[340px] rounded-[24px] bg-white px-7 pb-7 pt-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <span className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ECFAF1] text-[#009849]">
              <Search size={40} strokeWidth={2.2} />
            </span>
            <h2 className="text-[22px] font-extrabold text-[#111827]">No Marshals Found</h2>
            <p className="mt-2 px-2 text-sm font-medium leading-5 text-[#6B7280]">
              We couldn't find any nearby Marshals. Please try again.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="mt-7 h-14 w-full rounded-[18px] bg-[#009849] text-[17px] font-extrabold text-white shadow-[0_4px_12px_rgba(0,152,73,0.3)] transition hover:bg-[#007A3B] active:scale-[0.99]"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => setShowNoRide(false)}
              className="mt-3 h-12 w-full rounded-[18px] bg-[#F3F4F6] text-[15px] font-bold text-[#6B7280] transition hover:bg-[#E5E7EB]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Cancel request confirm */}
      {showCancelConfirm ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/50 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel Request confirmation"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowCancelConfirm(false);
          }}
        >
          <div className="w-full max-w-[340px] rounded-[24px] bg-white px-7 pb-7 pt-8 text-center shadow-2xl">
            <span className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#FEF2F2] text-[#EF4444]">
              <X size={34} strokeWidth={2.4} />
            </span>
            <h2 className="text-[22px] font-extrabold text-[#111827]">Cancel Request?</h2>
            <p className="mt-2 text-sm font-medium leading-5 text-[#6B7280]">
              Your hand raise request will be cancelled and Marshals won't be notified.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(false);
                  handleCancel();
                }}
                disabled={cancelling}
                className="h-[52px] w-full rounded-[18px] bg-[#EF4444] text-base font-extrabold text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)] transition active:scale-[0.99] disabled:opacity-60"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setShowCancelConfirm(false)}
                className="h-11 w-full rounded-[18px] bg-[#F3F4F6] text-sm font-bold text-[#6B7280] transition hover:bg-[#E5E7EB]"
              >
                No, go back
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
