import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock3,
  Crosshair,
  Footprints,
  Gauge,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { normalizeCoordinate } from "../../../components/map/utils/routeGeometry";


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
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
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
/* The backend emits GeoJSON / OSRM geometry as [lng, lat] (see
   RouteGeometryAPIView and RoutePreviewAPIView). The previous local heuristic
   swapped whenever |first| <= 90, which is true for Indian longitudes (~81) and
   therefore mirrored every OMV polyline. Reuse the shared, already-correct
   normaliser used by the driver flow instead of duplicating the logic. */
function toLngLat(coord) {
  return normalizeCoordinate(coord, "auto");
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
   MAP COMPONENT — same maplibre map, same markers, same route line.

   Render fix:
   - The map is created ONCE. Parent callbacks (onUpdatePickup / onUpdateDestination)
     are new function instances on every PassengerFlow render; they used to be
     effect dependencies, so the whole map was torn down and rebuilt on every
     parent re-render (loading toggle, refresh, marker drag).
     They are now read through a ref, so every callback below is stable.
   - The map sits inside a `hidden sm:block` wrapper. It is resized whenever its
     container changes size, and re-fitted when it goes from 0×0 to visible.
   - fitBounds padding adapts to the container so a small canvas never throws.
───────────────────────────────────────────── */
function RouteMapPreview({ trip, pickup, destination, onUpdatePickup, onUpdateDestination }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ pickup: null, destination: null, stops: [] });
  const isMapReadyRef = useRef(false);
  const latestDataRef = useRef({ pickup, destination, trip });
  const callbacksRef = useRef({ onUpdatePickup, onUpdateDestination });
  const routeSourceId = "route-preview-source";
  const routeLayerId = "route-preview-layer";

  useEffect(() => { latestDataRef.current = { pickup, destination, trip }; }, [pickup, destination, trip]);
  useEffect(() => { callbacksRef.current = { onUpdatePickup, onUpdateDestination }; }, [onUpdatePickup, onUpdateDestination]);

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
    const container = map.getContainer();
    const width = container?.clientWidth || 0;
    const height = container?.clientHeight || 0;
    // Hidden / not laid out yet — fitting now would compute against a 0×0 canvas.
    if (!width || !height) return;
    const { pickup: p, destination: d, trip: t } = latestDataRef.current;
    const routeCoords = getRouteCoordinates(t, p, d);
    const points = [...routeCoords];
    if (hasValidCoords(p)) points.push([p.lon, p.lat]);
    if (hasValidCoords(d)) points.push([d.lon, d.lat]);
    if (points.length === 0) { map.easeTo({ center: [78.9629, 20.5937], zoom: 4.6, duration: 700 }); return; }
    if (points.length === 1) { map.easeTo({ center: points[0], zoom: 13, duration: 700 }); return; }
    const bounds = points.reduce((acc, coord) => acc.extend(coord), new maplibregl.LngLatBounds(points[0], points[0]));
    const pad = Math.max(24, Math.min(90, Math.floor(Math.min(width, height) / 4)));
    map.fitBounds(bounds, { padding: { top: pad, bottom: pad, left: pad, right: pad }, duration: 800, maxZoom: 13 });
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
          callbacksRef.current.onUpdatePickup?.(up); updateRouteLine(); fitMapToPoints();
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
          callbacksRef.current.onUpdateDestination?.(ud); updateRouteLine(); fitMapToPoints();
        });
        markersRef.current.destination = m;
      } else { markersRef.current.destination.setLngLat([d.lon, d.lat]); }
    } else if (markersRef.current.destination) { markersRef.current.destination.remove(); markersRef.current.destination = null; }
  }, [fitMapToPoints, updateRouteLine]);

  /* Create the map exactly once (all deps above are stable). */
  useEffect(() => {
    const container = mapContainer.current;
    if (mapRef.current || !container) return;
    const markers = markersRef.current;
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [80.9462, 26.8467],
      zoom: 10,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.resize();
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

    /* Keep the canvas in sync with its container (hidden → visible, breakpoint
       changes, window resize). Re-fit only when it first gets a real size. */
    let lastW = container.clientWidth;
    let lastH = container.clientHeight;
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (!mapRef.current) return;
            mapRef.current.resize();
            if ((!lastW || !lastH) && w && h && isMapReadyRef.current) fitMapToPoints();
            lastW = w;
            lastH = h;
          })
        : null;
    resizeObserver?.observe(container);

    return () => {
      resizeObserver?.disconnect();
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
      {/* maplibre forces `position: relative` on its container, so the sizing
          is done by this absolutely-positioned wrapper instead. */}
      <div className="absolute inset-0">
        <div ref={mapContainer} className="h-full w-full" />
      </div>
      {/* re-center button */}
      <button
        type="button"
        onClick={fitMapToPoints}
        className="absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition hover:bg-[#F9FAFB] active:scale-95"
        aria-label="Re-center map"
      >
        <Crosshair size={18} className="text-[#374151]" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   EXPANDED STOPS PANEL — same design as the driver StopsPanel
───────────────────────────────────────────── */
function StopsPanel({ stops, boardingStop, alightingStop }) {
  const ordered = useMemo(
    () =>
      [...stops].sort(
        (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
      ),
    [stops],
  );

  return (
    <div className="mt-3 rounded-[12px] bg-[#F9FAFB] px-3 py-2">
      {ordered.length === 0 ? (
        <p className="py-4 text-center text-[13px] font-medium text-[#6B7280]">
          Stop details are not available for this route yet.
        </p>
      ) : (
        ordered.map((stop, i) => {
          const isBoarding = boardingStop?.id
            ? String(stop.id) === String(boardingStop.id)
            : i === 0;
          const isAlighting = alightingStop?.id
            ? String(stop.id) === String(alightingStop.id)
            : i === ordered.length - 1;
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
                {i < ordered.length - 1 && (
                  <span className="min-h-4 w-0.5 flex-1 bg-[#D1D5DB]" />
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
   ROUTE CARD — same design as the driver RouteCard.
   Passenger data is unchanged: fare is what the rider pays, walking
   distances are shown, and the CTA still selects the route.
───────────────────────────────────────────── */
function RouteCard({ trip, pickup, destination, isBest, index, onPress, onToggleExpand, expanded }) {
  const routeCode = trip?.route_code;
  const routeName = trip?.name || "Shared ride";

  const boardingStop = trip?.pickup_stop;
  const alightingStop = trip?.dropoff_stop;

  const fromLabel = boardingStop?.name || shortPlace(pickup, "Pickup Point");
  const toLabel = alightingStop?.name || shortPlace(destination, "Drop-off Point");

  const firstMileWalk = trip?.first_mile_walk_meters || boardingStop?.distance_meters || 0;
  const lastMileWalk = trip?.last_mile_walk_meters || alightingStop?.distance_to_destination_meters || 0;
  const walkMicrocopy =
    firstMileWalk > 0 || lastMileWalk > 0
      ? `Walk to pickup ${formatWalkText(firstMileWalk)} · Walk from drop-off ${formatWalkText(lastMileWalk)}`
      : null;

  // Backend-authoritative fare. This card shows the price the rider pays, which
  // the dynamic route response supplies as fare.buddy_fare.
  const fareText = trip?.fare != null ? `₹${trip.fare}` : "--";
  const stops = trip?.stops || [];
  const stopsCount = stops.length;
  const routeKey = trip?.id || index;

  return (
    <article
      className={`rounded-[18px] border bg-white p-4 shadow-v-sm transition hover:shadow-v-md ${
        isBest ? "border-[1.5px] border-[#009849]" : "border-[#E5E7EB]"
      }`}
    >
      {/* Badge + route code + name */}
      <div className="mb-3 flex items-center gap-2">
        {isBest && (
          <span className="shrink-0 rounded-[6px] bg-[#009849] px-2.5 py-1 text-[10px] font-black tracking-[0.8px] text-white">
            BEST MATCH
          </span>
        )}
        {routeCode ? (
          <span className="shrink-0 rounded-[6px] bg-[#ECFAF1] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.4px] text-[#009849]">
            {routeCode}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#6B7280]">
          {routeName}
        </span>
      </div>

      {/* Endpoints — tap to select */}
      <button
        type="button"
        onClick={() => onPress?.(trip)}
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

      {/* Stats bar — ETA | Ride | Fare */}
      <div className="mt-3 flex items-center justify-evenly rounded-[12px] bg-[#F9FAFB] py-2.5">
        <span className="flex items-center gap-1.5">
          <Clock3 size={15} className="text-[#6B7280]" />
          <span className="flex flex-col items-start">
            <span className="text-[13px] font-bold leading-tight text-[#374151]">
              {formatDurationText(trip)}
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
              {formatDistanceText(trip)}
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
            Est. Fare
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
            onClick={() => onToggleExpand?.(routeKey)}
            className="inline-flex items-center gap-1 text-[13px] font-bold text-[#009849] transition hover:text-[#007A3B]"
            aria-expanded={expanded}
          >
            {expanded ? "Hide stops" : `View ${stopsCount} stops`}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {expanded && stopsCount > 0 && (
        <StopsPanel
          stops={stops}
          boardingStop={boardingStop}
          alightingStop={alightingStop}
        />
      )}

      {/* Select CTA */}
      <button
        type="button"
        onClick={() => onPress?.(trip)}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#009849] text-[15px] font-extrabold text-white shadow-[0_3px_8px_rgba(0,152,73,0.25)] transition hover:bg-[#007A3B] active:scale-[0.99]"
      >
        Select Route
        <ArrowRight size={16} strokeWidth={2.6} />
      </button>
    </article>
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
  error = "",
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
  // Count reflects exactly what the backend returned — a single generated
  // route reads "1 route found", never a fabricated number of alternatives.
  const routeCountLabel = `${routeCount} route${routeCount === 1 ? "" : "s"}`;
  const modeLabel = Array.isArray(trips) && trips.some((trip) => trip?.vehicle_type === "bike") ? "Bike" : "Auto";

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
        {!loading && !error && routeCount > 0 && (
          <p className="mb-2.5 mt-1 text-[13px] font-semibold text-[#6B7280]">
            {routeCountLabel} found for your journey
          </p>
        )}
        {loading && <StateCard>Finding best options...</StateCard>}
        {/* Reuses the existing StateCard treatment. The message arrives already
            sanitised from the route provider, so raw backend/OSRM text never
            reaches the rider. */}
        {!loading && error && <StateCard>{error}</StateCard>}
        {!loading && !error && routeCount === 0 && (
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
                  /* "BEST MATCH" is kept verbatim but only awarded when the data
                     source actually ranked the route first. A single
                     backend-generated route is not a match against anything. */
                  isBest={index === 0 && trip?.is_best_match !== false}
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
