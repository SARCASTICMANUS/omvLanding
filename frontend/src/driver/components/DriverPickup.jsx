import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  Flag,
  LoaderCircle,
  MapPin,
  Navigation,
  Timer,
} from "lucide-react";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";
import { BottomSheet, RouteLine, ScreenHeader, StatusBadge } from "../../components/vayy";
import { getDistance } from "../../components/map/utils/routeGeometry";
import useDriverLocationPush from "../hooks/useDriverLocationPush";
import { buildRouteSummary } from "./driverFlowUtils";
import { formatKm } from "./driverRideUtils";

const ARRIVAL_GATE_METERS = 300;

const haversineMeters = (from, to) => {
  if (!from || !to) return null;
  try {
    return getDistance([from.lng, from.lat], [to.lng, to.lat]);
  } catch {
    return null;
  }
};

export default function DriverPickup({ ride, route, onBack, onArrived }) {
  const summary = useMemo(() => buildRouteSummary(route || {}), [route]);
  const [position, setPosition] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const watchRef = useRef(null);

  useDriverLocationPush({ enabled: true, tripId: ride?.tripId || null });

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosition(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    watchRef.current = watchId;
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  const distanceMeters = haversineMeters(
    position,
    ride?.pickupLat != null && ride?.pickupLng != null
      ? { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) }
      : null,
  );
  const inRange = distanceMeters != null && distanceMeters <= ARRIVAL_GATE_METERS;
  const hasPickupCoords = ride?.pickupLat != null && ride?.pickupLng != null;
  const progress = distanceMeters != null ? Math.min(100, (distanceMeters / 1200) * 100) : 0;
  const progressColor = inRange
    ? "#009849"
    : distanceMeters != null && distanceMeters <= 5000
      ? "#22c55e"
      : "#f59e0b";

  const handleArrived = useCallback(async () => {
    setConfirming(false);
    setSubmitting(true);
    try {
      await api.patch(API_PATHS.dispatchArrived(ride.tripId), {
        ...(ride.boardingRequestId ? { boarding_request_id: ride.boardingRequestId } : {}),
      });
    } catch {
      // Arrival is advisory — the OTP step verifies the real trip state.
    } finally {
      setSubmitting(false);
      onArrived?.();
    }
  }, [onArrived, ride?.tripId, ride?.boardingRequestId]);

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-[430px] sm:pb-[450px]">
      <div className="mx-auto w-full max-w-[560px] px-4 pt-4 sm:px-6 lg:max-w-[720px]">
        <ScreenHeader
          title="Ride to Pickup"
          subtitle={summary.title}
          onBack={onBack}
          right={
            <StatusBadge tone={position ? "live" : "neutral"}>
              <span
                className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                  position ? "bg-[#009849]" : "bg-[#9CA3AF]"
                }`}
              />
              {position ? "GPS live" : "Locating…"}
            </StatusBadge>
          }
        />

        {/* Heading to pickup — progress toward the pickup point */}
        <section className="mt-2 rounded-vayy border border-[#F0F0F0] bg-white p-4 shadow-v-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-v-md bg-[#ECFAF1] text-[#009849]">
                <Navigation size={18} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold text-[#111827]">
                  Heading to pickup
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-medium text-[#9CA3AF]">
                  <span className="truncate">{ride?.pickup || "Pickup"}</span>
                  <span className="flex shrink-0 items-center gap-[3px]" aria-hidden="true">
                    {[0, 1, 2].map((dotIndex) => (
                      <span
                        key={dotIndex}
                        className="h-1 w-1 animate-pulse rounded-full bg-[#6B7280]"
                        style={{ animationDelay: `${dotIndex * 300}ms` }}
                      />
                    ))}
                  </span>
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[#ECFAF1] px-3 py-1.5 text-[13px] font-bold text-[#009849]">
              <Timer size={12} className="mr-1 inline-block align-[-1px]" />
              {ride?.eta ? `${ride.eta} min` : "—"}
            </span>
          </div>

          <RouteLine progress={progress} knobIcon={<Navigation size={13} />} className="mt-3" />

          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[#9CA3AF]">
            <span>Now</span>
            <span className={`truncate ${inRange ? "text-[#009849]" : ""}`}>
              {inRange
                ? "At the pickup point"
                : hasPickupCoords
                  ? `${ARRIVAL_GATE_METERS} m arrival gate`
                  : "Pickup coordinates unavailable"}
            </span>
          </div>
        </section>
      </div>

      {/* Bottom sheet — replica of the mobile ride-to-pickup sheet */}
      <BottomSheet>
        <div className="flex items-center gap-3">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#009849] text-[17px] font-black text-white">
            {ride?.avatar || "-"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-extrabold text-[#111827]">
              {ride?.name || "-"}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-[#6B7280]">
              {ride?.pickup || "-"}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#ECFAF1] px-3 py-1.5 text-[13px] font-bold text-[#009849]">
            <Timer size={13} />
            {ride?.eta ? `${ride.eta} min` : "—"}
          </span>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#009849]" />
            <span className="text-[22px] font-black leading-none text-[#111827]">
              {distanceMeters != null ? formatKm(distanceMeters / 1000) : "—"}
            </span>
            <span className="text-[13px] font-medium text-[#9CA3AF]">to pickup</span>
          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progress}%`, backgroundColor: progressColor }}
            />
          </div>

          <div className="mt-1 flex justify-between text-[11px] font-semibold text-[#9CA3AF]">
            <span>{distanceMeters != null ? formatKm(distanceMeters / 1000) : "—"}</span>
            <span>1.2 km</span>
          </div>
        </div>

        {!inRange && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            <Flag size={14} className="text-[#9CA3AF]" />
            <p className="text-[12px] font-semibold text-[#9CA3AF]">
              Arrive within {ARRIVAL_GATE_METERS} m to activate
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={submitting}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-vayy bg-[#009849] px-5 text-[17px] font-extrabold text-white shadow-[0_4px_14px_rgba(0,152,73,0.35)] transition hover:bg-[#007A3B] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#D1D5DB] disabled:shadow-none"
        >
          {submitting ? (
            <LoaderCircle size={20} className="animate-spin" />
          ) : (
            <Flag size={20} strokeWidth={2.4} />
          )}
          {submitting ? "Marking Arrived…" : "I've Arrived at Pickup"}
        </button>

        {!inRange && hasPickupCoords && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={submitting}
            className="mt-2 h-12 w-full rounded-vayy border border-[#E5E7EB] bg-white text-[14px] font-extrabold text-[#6B7280] transition hover:border-[#009849] hover:text-[#009849] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Arrived anyway
          </button>
        )}
      </BottomSheet>

      {confirming && (
        <div
          className="fixed inset-0 z-[6000] flex items-end justify-center bg-slate-950/45 px-4 pb-6 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm arrival"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !submitting) setConfirming(false);
          }}
        >
          <div className="w-full max-w-[340px] rounded-v-xl bg-white px-7 pb-7 pt-8 text-center shadow-2xl">
            <CircleCheck size={52} className="mx-auto text-[#009849]" strokeWidth={2.2} />
            <h2 className="mt-3 text-[20px] font-extrabold text-[#111827]">
              Confirm Arrival
            </h2>
            <p className="mt-2 text-[14px] font-medium leading-5 text-[#6B7280]">
              Have you reached
              <br />
              <span className="font-bold text-[#111827]">
                {ride?.pickup || "the pickup point"}
              </span>
              ?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="h-[52px] flex-1 rounded-vayy border-[1.5px] border-[#E5E7EB] text-[15px] font-bold text-[#6B7280] transition hover:bg-slate-50 disabled:opacity-50"
              >
                Not Yet
              </button>
              <button
                type="button"
                onClick={handleArrived}
                disabled={submitting}
                className="flex h-[52px] flex-[1.5] items-center justify-center gap-2 rounded-vayy bg-[#009849] text-[15px] font-bold text-white transition hover:bg-[#007A3B] disabled:opacity-60"
              >
                {!submitting && <Check size={18} strokeWidth={3} />}
                {submitting ? "Working…" : "Yes, I'm Here"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
