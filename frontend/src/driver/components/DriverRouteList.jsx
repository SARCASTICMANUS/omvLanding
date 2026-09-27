import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Footprints,
  Gauge,
  MapPin,
  Route,
  SearchX,
} from "lucide-react";
import {
  buildRouteSummary,
  estimateStopTimeline,
} from "./driverFlowUtils";

const COUNT_BADGE =
  "inline-flex items-center rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-[12px] font-extrabold text-[#15803d]";

const STATE_CARD =
  "flex flex-col items-center justify-center rounded-[18px] border border-[#F0F0F0] bg-white px-6 py-16 text-center shadow-v-sm";

/* ─────────────────────────────────────────────
   EXPANDED STOPS PANEL (mobile DriverRouteList stopsPanel)
───────────────────────────────────────────── */
function StopsPanel({ route }) {
  const timeline = useMemo(() => estimateStopTimeline(route), [route]);

  const pickupOrder = route?.pickup_stop?.order;
  const dropoffOrder = route?.dropoff_stop?.order;

  return (
    <div className="mt-3 rounded-[12px] bg-[#F9FAFB] px-3 py-2">
      {timeline.length === 0 ? (
        <p className="py-4 text-center text-[13px] font-medium text-[#6B7280]">
          Stop details are not available for this route yet.
        </p>
      ) : (
        timeline.map((stop, i) => {
          const isBoarding =
            pickupOrder != null
              ? Number(stop.order) === Number(pickupOrder)
              : i === 0;
          const isAlighting =
            dropoffOrder != null
              ? Number(stop.order) === Number(dropoffOrder)
              : i === timeline.length - 1;
          const dotColor = isBoarding
            ? "#009849"
            : isAlighting
              ? "#f59e0b"
              : "#D1D5DB";

          return (
            <div key={stop.id || i} className="flex min-h-9 items-start">
              <span className="flex w-5 flex-col items-center pt-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                {i < timeline.length - 1 && (
                  <span className="w-0.5 min-h-4 flex-1 bg-[#D1D5DB]" />
                )}
              </span>

              <span className="ml-2 min-w-0 flex-1 py-1">
                <span className="block truncate text-[13px] font-semibold text-[#111827]">
                  {stop.name}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-[#9CA3AF]">
                  Stop {stop.order ?? i + 1}
                </span>
              </span>

              {isBoarding && (
                <span className="ml-2 self-center rounded-[6px] bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#009849]">
                  Boarding
                </span>
              )}
              {isAlighting && (
                <span className="ml-2 self-center rounded-[6px] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                  Alight
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUTE CARD (mobile DriverRouteList RouteCard)
───────────────────────────────────────────── */
function RouteCard({ route, index, expanded, onToggleExpand, onSelect }) {
  const stopsCount = route.stopsCount || route.stops?.length || 0;
  const isBest = index === 0;
  const isExpanded = expanded;

  const fromLabel = route.startLabel || "Start";
  const toLabel = route.endLabel || "End";
  const fareText = route.fare != null ? `₹${route.fare}` : "--";

  const firstMileKm =
    route.first_mile_walk_meters != null
      ? (route.first_mile_walk_meters / 1000).toFixed(1)
      : null;
  const lastMileKm =
    route.last_mile_walk_meters != null
      ? (route.last_mile_walk_meters / 1000).toFixed(1)
      : null;
  const walkMicrocopy =
    firstMileKm != null && lastMileKm != null
      ? `Board ${firstMileKm} km · Alight ${lastMileKm} km`
      : null;

  const handleSelect = () => onSelect?.(route);

  return (
    <article
      className={`rounded-[18px] border bg-white p-4 shadow-v-sm transition hover:shadow-v-md ${
        isBest ? "border-[1.5px] border-[#009849]" : "border-[#E5E7EB]"
      }`}
    >
      {/* Route code + name */}
      <div className="mb-3 flex items-center gap-2">
        {isBest && (
          <span className="shrink-0 rounded-[6px] bg-[#009849] px-2.5 py-1 text-[10px] font-black tracking-[0.8px] text-white">
            BEST MATCH
          </span>
        )}
        {route.code ? (
          <span className="shrink-0 rounded-[6px] bg-[#ECFAF1] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.4px] text-[#009849]">
            {route.code}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#6B7280]">
          {route.title}
        </span>
      </div>

      {/* Collapsed endpoints — tap to select */}
      <button
        type="button"
        onClick={handleSelect}
        className="flex w-full items-center gap-3 rounded-[12px] text-left transition hover:bg-[#F9FBFA]"
      >
        <span className="flex w-8 flex-col items-center gap-1.5 self-stretch">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#009849] text-[14px] font-black text-white">
            {index + 1}
          </span>
          <span className="w-0.5 flex-1 rounded bg-[#d1d5db]" />
        </span>

        <span className="min-w-0 flex-1 py-1">
          <span className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full bg-[#009849]" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-[#111827]">
              {fromLabel}
            </span>
          </span>
          <span className="my-1 ml-[4px] block h-3.5 border-l-[1.5px] border-dashed border-[#d1d5db]" />
          <span className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full bg-[#f59e0b]" />
            <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold text-[#111827]">
              {toLabel}
            </span>
          </span>
        </span>
      </button>

      {/* Stats bar — ETA | Ride | Earnings */}
      <div className="mt-3 flex items-center justify-evenly rounded-[12px] bg-[#F9FAFB] py-2.5">
        <span className="flex items-center gap-1.5">
          <Clock3 size={15} className="text-[#6B7280]" />
          <span className="flex flex-col items-start">
            <span className="text-[13px] font-bold leading-tight text-[#374151]">
              {route.durationText || "--"}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.4px] text-[#9CA3AF]">
              ETA
            </span>
          </span>
        </span>

        <span className="h-4 w-px bg-[#E5E7EB]" />

        <span className="flex items-center gap-1.5">
          <Gauge size={14} className="text-[#6B7280]" />
          <span className="flex flex-col items-start">
            <span className="text-[13px] font-bold leading-tight text-[#374151]">
              {route.distanceText || "--"}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.4px] text-[#9CA3AF]">
              Ride
            </span>
          </span>
        </span>

        <span className="h-4 w-px bg-[#E5E7EB]" />

        <span className="flex flex-col items-start">
          <span className="text-[16px] font-black leading-tight text-[#009849]">
            {fareText}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.4px] text-[#9CA3AF]">
            Earnings
          </span>
        </span>
      </div>

      {/* Walk microcopy */}
      {walkMicrocopy && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#9CA3AF]">
          <Footprints size={13} />
          {walkMicrocopy}
        </div>
      )}

      {/* Stops count + View N stops toggle */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#ECFAF1] px-2.5 py-1.5 text-[12px] font-bold text-[#009849]">
          <MapPin size={13} />
          {stopsCount} stops
        </span>

        {stopsCount > 0 && (
          <button
            type="button"
            onClick={() => onToggleExpand?.(route.id)}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-[#009849] transition hover:text-[#007A3B]"
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Hide stops" : `View ${stopsCount} stops`}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {isExpanded && <StopsPanel route={route} />}

      {/* Select CTA */}
      <button
        type="button"
        onClick={handleSelect}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#009849] text-[15px] font-extrabold text-white shadow-[0_3px_8px_rgba(0,152,73,0.25)] transition hover:bg-[#007A3B] active:scale-[0.99]"
      >
        Continue
        <ArrowRight size={16} strokeWidth={2.6} />
      </button>
    </article>
  );
}

/* ─────────────────────────────────────────────
   MAIN — DriverRouteList
   All original props + logic preserved
───────────────────────────────────────────── */
export default function DriverRouteList({
  source,
  destination,
  routes = [],
  allRoutesCount = 0,
  loading = false,
  onBack,
  onSelectRoute,
}) {
  const normalizedRoutes = useMemo(() => routes.map(buildRouteSummary), [routes]);
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  /* Derived — expand state is dropped during render when the route disappeared
     (avoids a setState call inside an effect). */
  const activeExpandedId = normalizedRoutes.some(
    (r) => String(r.id) === String(expandedRouteId),
  )
    ? expandedRouteId
    : null;

  /* Derived */
  const fromLabel =
    source?.name || source?.display_name?.split(",")?.[0] || "Start";
  const toLabel =
    destination?.name || destination?.display_name?.split(",")?.[0] || "Destination";
  const activeCount = normalizedRoutes.filter((r) => r.status?.active).length;

  return (
    <div className="min-h-screen w-full bg-[#F4F6F4] font-sans text-[#111827]">
      {/* ── GREEN HEADER (mobile rounded-b-[32px] pattern) ── */}
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-4 pb-5 pt-5 sm:px-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-30" />
          <span className="absolute -right-6 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition active:scale-95"
          >
            <ArrowLeft size={22} className="text-[#111827]" strokeWidth={2.4} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-black leading-tight text-white">
              Choose Route
            </h1>
            <p className="mt-0.5 truncate text-[13px] font-bold text-white/80">
              Select the route you want to drive
            </p>
          </div>

          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
            <Route size={20} strokeWidth={2.2} />
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-14 pt-4 sm:px-6">
        {/* Counts */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium text-[#6B7280]">
            {fromLabel} → {toLabel}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={COUNT_BADGE}>
              {normalizedRoutes.length} route
              {normalizedRoutes.length === 1 ? "" : "s"} available
            </span>
            {allRoutesCount > normalizedRoutes.length && (
              <span className={COUNT_BADGE}>
                Showing {normalizedRoutes.length} of {allRoutesCount}
              </span>
            )}
            {activeCount > 0 && (
              <span className={COUNT_BADGE}>{activeCount} Live</span>
            )}
          </div>
        </div>

        {/* Route list */}
        <div className="mt-3 flex flex-col gap-3">
          {loading ? (
            <div className={STATE_CARD}>
              <p className="text-[15px] font-semibold text-[#9CA3AF]">
                Loading routes...
              </p>
            </div>
          ) : normalizedRoutes.length === 0 ? (
            <div className={STATE_CARD}>
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F3F4F6]">
                <SearchX size={28} className="text-[#9CA3AF]" />
              </span>
              <h2 className="text-[20px] font-black text-[#111827]">
                No routes found
              </h2>
              <p className="mt-2 max-w-[420px] text-[14px] font-medium leading-6 text-[#6B7280]">
                No saved operational route currently matches the searched start
                and destination points.
              </p>
            </div>
          ) : (
            normalizedRoutes.map((route, i) => (
              <RouteCard
                key={route.id ?? i}
                route={route}
                index={i}
                expanded={String(activeExpandedId) === String(route.id)}
                onToggleExpand={(id) =>
                  setExpandedRouteId((cur) =>
                    String(cur) === String(id) ? null : id,
                  )
                }
                onSelect={onSelectRoute}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
