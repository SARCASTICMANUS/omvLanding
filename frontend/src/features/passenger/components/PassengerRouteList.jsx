import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Crosshair,
  Footprints,
  Navigation,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";


/* ─────────────────────────────────────────────
   HELPERS — original web helpers + mobile formatWalkText
───────────────────────────────────────────── */
function formatEtaMinutes(etaSeconds) {
  return Math.max(1, Math.ceil(Number(etaSeconds || 300) / 60));
}
function formatDistanceText(trip) {
  if (trip?.distance_text) return trip.distance_text;
  if (trip?.distance_km) return `${trip.distance_km} km`;
  return "45 km";
}
function formatDurationText(trip) {
  if (trip?.duration_text) return trip.duration_text;
  if (trip?.eta_seconds) return `${formatEtaMinutes(trip.eta_seconds)} min`;
  return "45 min";
}
function formatWalkText(meters) {
  if (!meters || meters <= 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m walk`;
  return `${(meters / 1000).toFixed(1)} km walk`;
}
function shortPlace(point, fallback) {
  return (
    point?.name ||
    point?.display_name?.split(",")?.[0] ||
    point?.address ||
    fallback
  );
}
function hasValidCoords(point) {
  return (
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon)
  );
}
function createCircleMarker(color, size = 16) {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.backgroundColor = color;
  el.style.border = "3px solid white";
  el.style.boxShadow = `0 4px 12px ${color}55, 0 4px 12px rgba(0,0,0,0.20)`;
  el.style.cursor = "grab";
  return el;
}
function createStopMarker(label) {
  const el = document.createElement("div");
  el.style.width = "20px";
  el.style.height = "20px";
  el.style.borderRadius = "9999px";
  el.style.background = "#009849";
  el.style.border = "2px solid rgba(255,255,255,0.92)";
  el.style.boxShadow = "0 4px 10px rgba(0,152,73,0.35)";
  el.style.color = "white";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "9px";
  el.style.fontWeight = "900";
  el.textContent = label;
  return el;
}
function toLngLat(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const first = Number(coord[0]);
  const second = Number(coord[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
  return [first, second];
}
function getRouteCoordinates(trip, pickup, destination) {
  const rawPath =
    trip?.route_geometry ||
    trip?.path_coords ||
    trip?.route_path ||
    trip?.path ||
    trip?.route?.path_coords ||
    trip?.route?.route_geometry;
  if (Array.isArray(rawPath) && rawPath.length > 1) {
    const normalized = rawPath.map(toLngLat).filter(Boolean);
    if (normalized.length > 1) return normalized;
  }
  if (rawPath?.type === "LineString" && Array.isArray(rawPath.coordinates)) {
    const normalized = rawPath.coordinates.map(toLngLat).filter(Boolean);
    if (normalized.length > 1) return normalized;
  }
  if (hasValidCoords(pickup) && hasValidCoords(destination)) {
    return [
      [pickup.lon, pickup.lat],
      [destination.lon, destination.lat],
    ];
  }
  return [];
}
function getRouteStops(trip, routeCoordinates) {
  if (Array.isArray(trip?.stops) && trip.stops.length > 0) {
    return trip.stops
      .map((stop, index) => ({
        id: stop.id || `${stop.name || "stop"}-${index}`,
        name: stop.name || `Stop ${index + 1}`,
        order: Number.isFinite(Number(stop.order)) ? Number(stop.order) : index,
        coord:
          typeof stop.lat === "number" && typeof stop.lon === "number"
            ? [stop.lon, stop.lat]
            : toLngLat(stop.coords || stop.location),
      }))
      .filter((stop) => Array.isArray(stop.coord))
      .sort((a, b) => a.order - b.order);
  }
  if (routeCoordinates.length > 1) {
    return [
      { id: "route-start", name: "Start", order: 0, coord: routeCoordinates[0] },
      { id: "route-end", name: "End", order: 1, coord: routeCoordinates[routeCoordinates.length - 1] },
    ];
  }
  return [];
}

/* ─────────────────────────────────────────────
   MAP COMPONENT — all maplibre logic untouched
───────────────────────────────────────────── */
function RouteMapPreview({ trip, pickup, destination, onUpdatePickup, onUpdateDestination }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ pickup: null, destination: null, stops: [] });
  const isMapReadyRef = useRef(false);
  const latestDataRef = useRef({ pickup, destination, trip });
  const routeSourceId = "route-preview-source";
  const routeLayerId = "route-preview-layer";

  useEffect(() => { latestDataRef.current = { pickup, destination, trip }; }, [pickup, destination, trip]);

  const updateRouteLine = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;
    const source = map.getSource(routeSourceId);
    if (!source) return;
    const { pickup: p, destination: d, trip: t } = latestDataRef.current;
    const coords = getRouteCoordinates(t, p, d);
    source.setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} });
  }, []);

  const fitMapToPoints = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;
    const { pickup: p, destination: d, trip: t } = latestDataRef.current;
    const routeCoords = getRouteCoordinates(t, p, d);
    const points = [...routeCoords];
    if (hasValidCoords(p)) points.push([p.lon, p.lat]);
    if (hasValidCoords(d)) points.push([d.lon, d.lat]);
    if (points.length === 0) { map.easeTo({ center: [78.9629, 20.5937], zoom: 4.6, duration: 700 }); return; }
    if (points.length === 1) { map.easeTo({ center: points[0], zoom: 13, duration: 700 }); return; }
    const bounds = points.reduce((acc, coord) => acc.extend(coord), new maplibregl.LngLatBounds(points[0], points[0]));
    map.fitBounds(bounds, { padding: { top: 90, bottom: 90, left: 90, right: 90 }, duration: 800, maxZoom: 13 });
  }, []);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;
    const { pickup: p, destination: d, trip: t } = latestDataRef.current;
    const routeCoords = getRouteCoordinates(t, p, d);
    const stops = getRouteStops(t, routeCoords);

    markersRef.current.stops.forEach((m) => m.remove());
    markersRef.current.stops = stops.map((stop, i) =>
      new maplibregl.Marker({ element: createStopMarker(String(i + 1)) })
        .setLngLat(stop.coord).addTo(map)
    );

    if (hasValidCoords(p)) {
      if (!markersRef.current.pickup) {
        const m = new maplibregl.Marker({ element: createCircleMarker("#009849"), draggable: true })
          .setLngLat([p.lon, p.lat]).addTo(map);
        m.on("dragstart", () => { m.getElement().style.cursor = "grabbing"; });
        m.on("dragend", () => {
          const ll = m.getLngLat();
          const up = { ...latestDataRef.current.pickup, lon: ll.lng, lat: ll.lat };
          latestDataRef.current = { ...latestDataRef.current, pickup: up };
          m.getElement().style.cursor = "grab";
          onUpdatePickup?.(up); updateRouteLine(); fitMapToPoints();
        });
        markersRef.current.pickup = m;
      } else { markersRef.current.pickup.setLngLat([p.lon, p.lat]); }
    } else if (markersRef.current.pickup) { markersRef.current.pickup.remove(); markersRef.current.pickup = null; }

    if (hasValidCoords(d)) {
      if (!markersRef.current.destination) {
        const m = new maplibregl.Marker({ element: createCircleMarker("#ef4444"), draggable: true })
          .setLngLat([d.lon, d.lat]).addTo(map);
        m.on("dragstart", () => { m.getElement().style.cursor = "grabbing"; });
        m.on("dragend", () => {
          const ll = m.getLngLat();
          const ud = { ...latestDataRef.current.destination, lon: ll.lng, lat: ll.lat };
          latestDataRef.current = { ...latestDataRef.current, destination: ud };
          m.getElement().style.cursor = "grab";
          onUpdateDestination?.(ud); updateRouteLine(); fitMapToPoints();
        });
        markersRef.current.destination = m;
      } else { markersRef.current.destination.setLngLat([d.lon, d.lat]); }
    } else if (markersRef.current.destination) { markersRef.current.destination.remove(); markersRef.current.destination = null; }
  }, [fitMapToPoints, onUpdateDestination, onUpdatePickup, updateRouteLine]);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;
    const markers = markersRef.current;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [80.9462, 26.8467],
      zoom: 10,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      isMapReadyRef.current = true;
      if (!map.getSource(routeSourceId)) {
        map.addSource(routeSourceId, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} } });
      }
      if (!map.getLayer(routeLayerId)) {
        map.addLayer({
          id: routeLayerId, type: "line", source: routeSourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#009849", "line-width": 4, "line-opacity": 0.95, "line-dasharray": [3, 2] },
        });
      }
      syncMarkers(); updateRouteLine(); fitMapToPoints();
    });
    return () => {
      isMapReadyRef.current = false;
      if (markers.pickup) markers.pickup.remove();
      if (markers.destination) markers.destination.remove();
      markers.stops.forEach((m) => m.remove());
      markers.pickup = null; markers.destination = null; markers.stops = [];
      map.remove(); mapRef.current = null;
    };
  }, [fitMapToPoints, syncMarkers, updateRouteLine]);

  useEffect(() => {
    if (!mapRef.current || !isMapReadyRef.current) return;
    syncMarkers(); updateRouteLine(); fitMapToPoints();
  }, [fitMapToPoints, pickup, destination, syncMarkers, trip, updateRouteLine]);

  return (
    <div className="relative h-full min-h-[340px] w-full overflow-hidden rounded-[18px] border border-[#E5E7EB] shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
      <div ref={mapContainer} className="h-full w-full" />
      {/* re-center button */}
      <button
        type="button"
        onClick={fitMapToPoints}
        className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition hover:bg-[#F9FAFB] active:scale-95"
        aria-label="Re-center map"
      >
        <Crosshair size={18} className="text-[#374151]" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STOP CONNECTOR — replica of mobile StopDotLine
───────────────────────────────────────────── */
function StopDotLine({ pickupLabel, dropLabel, firstMileWalk, lastMileWalk }) {
  return (
    <div className="mt-0.5 flex flex-col">
      {/* Pickup */}
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full border-[2.5px] border-[#009849]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-[#111827]">{pickupLabel}</span>
          <span className="block text-[11px] font-medium text-[#6B7280]">
            Pickup{firstMileWalk ? `  •  ${formatWalkText(firstMileWalk)}` : ""}
          </span>
        </span>
      </div>

      {/* Dashed connector */}
      <div className="flex h-4 items-center pl-[5px]">
        <span className="h-4 border-l-[1.5px] border-dashed border-[#D1D5DB]" />
      </div>

      {/* Drop-off */}
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full border-[2.5px] border-[#F59E0B]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-[#111827]">{dropLabel}</span>
          <span className="block text-[11px] font-medium text-[#6B7280]">
            Drop-off{lastMileWalk ? `  •  ${formatWalkText(lastMileWalk)}` : ""}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUTE CARD — replica of mobile PassengerRouteList RouteCard
───────────────────────────────────────────── */
function RouteCard({ trip, pickup, destination, isBest, index, onPress, onToggleExpand, expanded }) {
  const routeCode = trip?.route_code || `R-${index + 1}`;
  const routeName = trip?.name || "Shared ride";

  const boardingStop = trip?.pickup_stop;
  const alightingStop = trip?.dropoff_stop;

  const boardLabel = boardingStop?.name || shortPlace(pickup, "Pickup Point");
  const alightLabel = alightingStop?.name || shortPlace(destination, "Drop-off Point");

  const firstMileWalk = trip?.first_mile_walk_meters || boardingStop?.distance_meters || 0;
  const lastMileWalk = trip?.last_mile_walk_meters || alightingStop?.distance_to_destination_meters || 0;

  const fare = trip?.fare ?? "—";
  const stops = trip?.stops || [];

  return (
    <div
      className={`rounded-[16px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
        isBest ? "border-[1.5px] border-[#009849]" : "border border-[#E5E7EB]"
      }`}
    >
      {/* BEST MATCH BADGE */}
      {isBest && (
        <span className="mb-3 inline-flex items-center gap-1 rounded-[6px] bg-[#009849] px-2 py-[3px] text-[10px] font-black tracking-[0.6px] text-white">
          <Sparkles size={12} strokeWidth={2} />
          BEST MATCH
        </span>
      )}

      <button
        type="button"
        onClick={() => onPress?.(trip)}
        className="flex w-full items-start gap-3 text-left transition active:opacity-90"
      >
        {/* ROUTE CODE BADGE */}
        <span className="flex shrink-0 items-center pt-0.5">
          <span
            className={`flex min-w-[42px] items-center justify-center rounded-[8px] px-1.5 py-1 text-[11px] font-black text-white ${
              isBest ? "bg-[#009849]" : "bg-[#374151]"
            }`}
          >
            {routeCode}
          </span>
        </span>

        {/* MAIN STOP TIMELINE */}
        <span className="min-w-0 flex-1">
          <span className="mb-1.5 block truncate text-[15px] font-extrabold text-[#111827]">
            {routeName}
          </span>
          <StopDotLine
            pickupLabel={boardLabel}
            dropLabel={alightLabel}
            firstMileWalk={firstMileWalk}
            lastMileWalk={lastMileWalk}
          />
        </span>

        {/* FARE COLUMN */}
        <span
          className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-[10px] px-2.5 py-1.5 ${
            isBest ? "border border-[#BBF7D0] bg-[#F0FDF4]" : "bg-[#F3F4F6]"
          }`}
        >
          <span
            className={`text-[16px] font-black leading-none ${
              isBest ? "text-[#009849]" : "text-[#111827]"
            }`}
          >
            ₹{fare}
          </span>
          <span className="mt-1 text-[9px] font-semibold leading-none text-[#9CA3AF]">Est. Fare</span>
        </span>
      </button>

      {/* METRICS & ACTIONS */}
      <div className="mt-3 border-t border-[#F3F4F6] pt-3">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-[3px]">
            <Footprints size={14} className="text-[#009849]" />
            <span className="text-[12px] font-semibold text-[#4B5563]">
              {formatWalkText(firstMileWalk + lastMileWalk)}
            </span>
          </span>
          <span className="text-[10px] text-[#D1D5DB]">•</span>
          <span className="flex items-center gap-[3px]">
            <Navigation size={14} className="text-[#6B7280]" />
            <span className="text-[12px] font-semibold text-[#4B5563]">{formatDistanceText(trip)}</span>
          </span>
          <span className="text-[10px] text-[#D1D5DB]">•</span>
          <span className="flex items-center gap-[3px]">
            <Clock3 size={14} className="text-[#6B7280]" />
            <span className="text-[12px] font-semibold text-[#4B5563]">
              {formatDurationText(trip)} total
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleExpand?.(trip?.id || index)}
            className="shrink-0 rounded-[10px] border border-[#E5E7EB] px-3 py-2 text-[12px] font-bold text-[#374151] transition enabled:hover:border-[#009849] enabled:hover:text-[#009849]"
          >
            {expanded ? "Hide Stops" : `Stops (${stops.length}) ›`}
          </button>

          <button
            type="button"
            onClick={() => onPress?.(trip)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-[10px] py-[9px] text-[13px] font-extrabold text-white transition ${
              isBest
                ? "bg-[#009849] enabled:hover:bg-[#007A3B]"
                : "bg-[#374151] enabled:hover:bg-[#1F2937]"
            }`}
          >
            Select Route
            <ArrowRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* EXPANDABLE STOPS LIST */}
      {expanded && stops.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-2.5">
          {stops.map((stop, si) => {
            const isBoarding = boardingStop?.id
              ? String(stop.id) === String(boardingStop.id)
              : si === 0;
            const isAlighting = alightingStop?.id
              ? String(stop.id) === String(alightingStop.id)
              : si === stops.length - 1;

            const seqBg = isBoarding
              ? "bg-[#009849]"
              : isAlighting
                ? "bg-[#F59E0B]"
                : "bg-[#E5E7EB]";
            const seqText = isBoarding || isAlighting ? "text-white" : "text-[#374151]";
            const statusText = isBoarding ? "Pickup Here" : isAlighting ? "Drop-off Here" : "On Route";
            const statusTextClass = isBoarding
              ? "text-[#009849]"
              : isAlighting
                ? "text-[#F59E0B]"
                : "text-[#374151]";

            return (
              <div key={stop.id || si} className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${seqBg} ${seqText}`}
                >
                  {stop.order || si + 1}
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-[#111827]">{stop.name}</span>
                  <span className={`shrink-0 text-[11px] font-bold ${statusTextClass}`}>{statusText}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOADING / EMPTY STATE CARD
───────────────────────────────────────────── */
function StateCard({ children }) {
  return (
    <div className="rounded-[16px] bg-white py-10 text-center text-[14px] font-semibold text-[#9CA3AF] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT — PassengerRouteList
   All props + handlers 100% preserved
───────────────────────────────────────────── */
export default function PassengerRouteList({
  onBack,
  onChooseRoute,
  trips = [],
  loading = false,
  pickup,
  destination,
  onUpdatePickup,
  onUpdateDestination,
  onReSearchRoutes,
}) {
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  const allTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];
    // Sort to prioritize active trips over route-only, then by ETA
    return [...trips].sort((a, b) => {
      const aRouteOnly = a.is_route_only || a.trip_available === false;
      const bRouteOnly = b.is_route_only || b.trip_available === false;

      if (aRouteOnly !== bRouteOnly) {
        return aRouteOnly ? 1 : -1; // Active trips first
      }

      // If both are active, sort by ETA (fastest first)
      if (!aRouteOnly) {
        return (a.eta_seconds || 0) - (b.eta_seconds || 0);
      }

      return 0;
    });
  }, [trips]);
  const bestTrip = allTrips[0] || null;
  const routeCount = allTrips.length;
  const modeLabel =
    Array.isArray(trips) && trips.some((trip) => trip?.vehicle_type === "bike")
      ? "Bike"
      : "Auto";

  const handleContinue = (trip) => { if (!trip) return; onChooseRoute?.(trip); };
  const handleToggleExpand = (id) =>
    setExpandedRouteId((current) => (String(current) === String(id) ? null : id));

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F8FAF9] font-sans">
      {/* HEADER — mobile PassengerRouteList header */}
      <header className="mx-auto w-full max-w-[1400px] px-4 pb-3 pt-2 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition active:scale-95"
          >
            <ArrowLeft size={20} className="text-[#111827]" strokeWidth={2.2} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold leading-tight text-[#111827]">
              Available Routes
            </h1>
            <p className="mt-px text-[13px] font-bold text-[#009849]">{modeLabel} Transit</p>
          </div>

          <button
            type="button"
            aria-label="Route filters"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition active:scale-95"
          >
            <SlidersHorizontal size={18} className="text-[#009849]" />
          </button>
        </div>
      </header>

      {/* ══ MAIN CONTENT ══ */}
      <main className="mx-auto w-full max-w-[1400px] px-4 pb-8 sm:px-5">
        {/* LIST STATES */}
        {!loading && routeCount > 0 && (
          <p className="mb-2.5 mt-1 text-[13px] font-semibold text-[#6B7280]">
            {routeCount} routes found for your journey
          </p>
        )}
        {loading && <StateCard>Finding best options...</StateCard>}
        {!loading && routeCount === 0 && (
          <StateCard>No matching rides found for this location.</StateCard>
        )}

        {/* ── RESPONSIVE GRID: map + route list (single DOM tree) ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          {/* LEFT: map preview — hidden below sm (mobile shows the list only) */}
          <div className="hidden h-[340px] sm:block lg:h-auto lg:min-h-[560px]">
            <RouteMapPreview
              trip={bestTrip}
              pickup={pickup}
              destination={destination}
              onUpdatePickup={onUpdatePickup}
              onUpdateDestination={onUpdateDestination}
            />
          </div>

          {/* RIGHT: route cards + actions */}
          <div className="flex flex-col gap-3">
            {!loading &&
              allTrips.map((trip, index) => (
                <RouteCard
                  key={String(trip?.id || index)}
                  trip={trip}
                  pickup={pickup}
                  destination={destination}
                  index={index}
                  isBest={index === 0}
                  expanded={String(expandedRouteId) === String(trip?.id || index)}
                  onPress={handleContinue}
                  onToggleExpand={handleToggleExpand}
                />
              ))}

            {/* Refresh matching rides */}
            <div className="mt-1 flex flex-col gap-3">
              <button
                type="button"
                onClick={onReSearchRoutes}
                disabled={!pickup || !destination || loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[18px] border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#6B7280] transition enabled:hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh Routes
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
