import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ArrowLeft,
  ArrowRight,
  BusFront,
  Check,
  Clock3,
  Globe2,
  MapPin,
  RefreshCw,
  Route,
  Star,
  Sun,
  UserRound,
  Menu,
  ChevronDown,
  Crosshair,
  TrendingUp,
  Bus,
  Bell,
  BarChart2,
  Calendar,
  MoreHorizontal,
} from "lucide-react";

/* ─────────────────────────────────────────────
   ALL ORIGINAL HELPER FUNCTIONS — UNTOUCHED
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
function createCircleMarker(color, size = 24) {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.backgroundColor = color;
  el.style.border = "5px solid white";
  el.style.boxShadow = `0 8px 22px ${color}55, 0 8px 22px rgba(0,0,0,0.20)`;
  el.style.cursor = "grab";
  return el;
}
function createStopMarker(label) {
  const el = document.createElement("div");
  el.style.width = "28px";
  el.style.height = "28px";
  el.style.borderRadius = "9999px";
  el.style.background = "#009849";
  el.style.border = "3px solid rgba(255,255,255,0.92)";
  el.style.boxShadow = "0 8px 18px rgba(0,152,73,0.35)";
  el.style.color = "white";
  el.style.display = "flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.fontSize = "12px";
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
   MAP COMPONENT — all logic untouched
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
    <div style={{
      position: "relative", width: "100%", borderRadius: 18, overflow: "hidden",
      border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      height: "100%", minHeight: 340,
    }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      {/* locate button */}
      <button
        type="button"
        onClick={fitMapToPoints}
        style={{
          position: "absolute", bottom: 16, right: 16,
          width: 40, height: 40, borderRadius: "50%",
          background: "white", border: "1px solid #e5e7eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)", cursor: "pointer",
        }}
        aria-label="Re-center map"
      >
        <Crosshair size={18} color="#374151" />
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────
   METRIC CHIP — distance / duration / stops
───────────────────────────────────────────── */
function MetricChip({ icon: Icon, value, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, justifyContent: "center" }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={19} color="#374151" strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   BEST MATCH CARD — right panel
───────────────────────────────────────────── */
function BestMatchCard({ trip, pickup, destination, onContinue }) {
  const isRouteOnly = trip?.is_route_only || trip?.trip_available === false;
  const busNo = trip?.bus_number || trip?.vehicle_number || trip?.vehicle_no || (isRouteOnly ? "Route match" : "UP 32 DC 0003");
  const eta = formatEtaMinutes(trip?.eta_seconds);
  const fromLabel = shortPlace(pickup, trip?.pickup_name || "Noida");
  const toLabel = shortPlace(destination, trip?.destination_name || "Delhi");
  const startTime = trip?.start_time || trip?.departure_time || (isRouteOnly ? "--" : "7:00 AM");
  const endTime = trip?.end_time || trip?.arrival_time || (isRouteOnly ? "--" : "8:00 AM");
  const distance = formatDistanceText(trip);
  const duration = formatDurationText(trip);
  const stopsCount = Array.isArray(trip?.stops) ? trip.stops.length : trip?.stops_count || trip?.stop_count || 8;
  const seatType = trip?.seat_type || trip?.vehicle_type || trip?.bus_type || (isRouteOnly ? "Route available" : "AC Seater");
  const rating = trip?.rating || trip?.score || "4.6";

  return (
    <div style={{
      background: "white", borderRadius: 18,
      border: "1px solid #f0f0f0",
      boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      padding: "24px",
      display: "flex", flexDirection: "column", gap: 0,
    }}>
      {/* Tag row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{
          background: isRouteOnly ? "#fef3c7" : "#f0fdf4",
          color: isRouteOnly ? "#92400e" : "#15803d",
          fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 20,
          letterSpacing: 0.5, textTransform: "uppercase",
        }}>
          {isRouteOnly ? "Route Found" : "Next Arriving Bus"}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: isRouteOnly ? "#b45309" : "#15803d" }}>
          {isRouteOnly ? "No active bus" : `Arrives in ${eta} min`}
        </span>
      </div>

      {/* Bus identity */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: isRouteOnly ? "#fff7ed" : "#f0fdf4",
            border: isRouteOnly ? "1.5px solid #fed7aa" : "1.5px solid #bbf7d0",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BusFront size={28} color={isRouteOnly ? "#d97706" : "#009849"} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1 }}>{busNo}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{seatType}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 16, fontWeight: 800, color: "#111827" }}>
          <Star size={16} fill="#111827" strokeWidth={0} />
          {rating}
        </div>
      </div>

      {/* Route line */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#009849", flexShrink: 0 }} />
        <div style={{ flex: 1, borderTop: "2px dashed #009849" }} />
        <ArrowRight size={18} color="#374151" strokeWidth={2.5} />
        <div style={{ flex: 1, borderTop: "2px dashed #d1d5db" }} />
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#ef4444", flexShrink: 0 }} />
      </div>

      {/* From / To */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 8, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{fromLabel}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{startTime}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{toLabel}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>{endTime}</div>
        </div>
      </div>

      {/* Passing your stop banner */}
      <div style={{
        background: isRouteOnly ? "#fff7ed" : "#f0fdf4",
        border: isRouteOnly ? "1.5px solid #fed7aa" : "1.5px solid #bbf7d0",
        borderRadius: 14,
        padding: "12px 16px", display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            border: isRouteOnly ? "2px solid #d97706" : "2px solid #009849",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Check size={15} color={isRouteOnly ? "#d97706" : "#009849"} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: isRouteOnly ? "#b45309" : "#009849" }}>
              {isRouteOnly ? "Route found but no active bus" : "Passing your stop"}
            </div>
            <div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>Board at {fromLabel}</div>
          </div>
        </div>
        <button type="button" onClick={() => window.history.back()} style={{
          fontSize: 13, fontWeight: 700, color: isRouteOnly ? "#b45309" : "#009849", background: "none", border: "none", cursor: "pointer",
        }}>Change</button>
      </div>

      {/* Metrics */}
      <div style={{
        display: "flex", alignItems: "center",
        borderTop: "1px solid #f0f0f0", borderBottom: "1px solid #f0f0f0",
        padding: "14px 0",
        gap: 0,
      }}>
        <MetricChip icon={TrendingUp} value={distance} label="Distance" />
        <div style={{ width: 1, height: 36, background: "#f0f0f0" }} />
        <MetricChip icon={Clock3} value={duration} label="Duration" />
        <div style={{ width: 1, height: 36, background: "#f0f0f0" }} />
        <MetricChip icon={BusFront} value={stopsCount} label="Stops" />
      </div>

      {/* Hidden original button kept for API compatibility */}
      <button type="button" onClick={() => onContinue(trip)} className="hidden" aria-label="Continue route" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   OTHER BUS ROW — all buses list
───────────────────────────────────────────── */
function OtherBusRow({ trip, pickup, destination, onChooseRoute }) {
  return (
    <button
      type="button"
      onClick={() => onChooseRoute?.(trip)}
      style={{
        display: "flex", width: "100%", alignItems: "center",
        justifyContent: "space-between",
        borderRadius: 14, border: "1.5px solid #e5e7eb",
        background: "white", padding: "14px 16px", textAlign: "left",
        cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#009849"; e.currentTarget.style.background = "#f0fdf4"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "white"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: "#f0fdf4",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BusFront size={20} color="#009849" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
            {trip?.bus_number || trip?.vehicle_number || "Bus"}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            {shortPlace(pickup, trip?.pickup_name || "Pickup")} → {shortPlace(destination, trip?.destination_name || "Drop")}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#009849" }}>
        {formatEtaMinutes(trip?.eta_seconds)} min
      </span>
    </button>
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
  onShowAllBuses,
}) {
  const [showAllBuses, setShowAllBuses] = useState(false);

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
  const isRouteOnly = bestTrip?.is_route_only || bestTrip?.trip_available === false;
  const eta = isRouteOnly ? "--" : formatEtaMinutes(bestTrip?.eta_seconds);

  const handleContinue = (trip) => { if (!trip) return; onChooseRoute?.(trip); };
  const handleViewAllBuses = () => {
    if (!showAllBuses && onShowAllBuses) onShowAllBuses();
    setShowAllBuses((prev) => !prev);
  };

  const css = `
    .prl-root { font-family: inherit; }
    .prl-root * { box-sizing: border-box; }

    /* hide maplibre controls */
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-top-right { display: none !important; }

    /* responsive: desktop shows 2-col grid, mobile is single col */
    .prl-body-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }

    @keyframes prl-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .prl-animate-spin {
      animation: prl-spin 1s linear infinite;
    }
    @media (min-width: 1024px) {
      .prl-body-grid {
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }
      .prl-map-col { height: 100%; min-height: 560px; }
      .mobile-only { display: none !important; }
      .desktop-only { display: flex !important; }
    }
    @media (max-width: 1023px) {
      .prl-map-col { height: 300px; }
      .desktop-only { display: none !important; }
      .mobile-only { display: block !important; }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div
        className="prl-root"
        style={{
          minHeight: "calc(100vh - 64px)", background: "#F8FAF9",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* redundant local navbar removed */}

        {/* ══ MAIN CONTENT ══ */}
        <main style={{ flex: 1, maxWidth: 1400, width: "100%", margin: "0 auto", padding: "24px 20px 24px", display: "flex", flexDirection: "column" }}>

          {/* Page heading row */}
          <div style={{ position: "relative", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  width: 44, height: 44, borderRadius: "50%",
                  border: "1.5px solid #e5e7eb", background: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  flexShrink: 0,
                }}
                aria-label="Back"
              >
                <ArrowLeft size={20} color="#374151" strokeWidth={2.2} />
              </button>

              <div>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1, margin: 0 }}>
                  Best <span style={{ color: "#009849" }}>Match</span>
                </h1>
                <p style={{ fontSize: 14, color: "#6b7280", marginTop: 6, margin: "6px 0 0" }}>
                  The best bus option for your trip
                </p>
              </div>
            </div>
          </div>

          {/* ── TWO COLUMN GRID ── */}
          <div className="prl-body-grid" style={{ flex: 1 }}>
            {/* LEFT: Map */}
            <div className="prl-map-col" style={{ height: "100%" }}>
              <RouteMapPreview
                trip={bestTrip}
                pickup={pickup}
                destination={destination}
                onUpdatePickup={onUpdatePickup}
                onUpdateDestination={onUpdateDestination}
              />
            </div>

            {/* RIGHT: Card + buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
              {loading ? (
                <div style={{
                  background: "white", borderRadius: 18, padding: 40,
                  textAlign: "center", fontSize: 16, fontWeight: 700, color: "#374151",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0",
                }}>
                  Loading routes...
                </div>
              ) : bestTrip ? (
                <BestMatchCard
                  trip={bestTrip}
                  pickup={pickup}
                  destination={destination}
                  onContinue={handleContinue}
                />
              ) : (
                <div style={{
                  background: "white", borderRadius: 18, padding: 40,
                  textAlign: "center", fontSize: 16, fontWeight: 700, color: "#374151",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0",
                }}>
                  No route found
                </div>
              )}

              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Continue CTA */}
                <button
                  type="button"
                  onClick={() => handleContinue(bestTrip)}
                  disabled={!bestTrip || loading}
                  style={{
                    width: "100%", height: 56, borderRadius: 18, border: "none",
                    background: !bestTrip || loading ? "#d1d5db" : (isRouteOnly ? "#374151" : "#009849"),
                    color: "white", fontWeight: 800, fontSize: 16, fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    cursor: !bestTrip || loading ? "not-allowed" : "pointer",
                    boxShadow: !bestTrip || loading ? "none" : (isRouteOnly ? "0 4px 20px rgba(0,0,0,0.1)" : "0 4px 20px rgba(0,152,73,0.3)"),
                    transition: "background 0.18s, transform 0.12s",
                  }}
                  onMouseEnter={e => { if (bestTrip && !loading) e.currentTarget.style.background = isRouteOnly ? "#1f2937" : "#007a3d"; }}
                  onMouseLeave={e => { if (bestTrip && !loading) e.currentTarget.style.background = isRouteOnly ? "#374151" : "#009849"; }}
                >
                  {isRouteOnly ? "View Route Details" : "Continue"}
                  {!isRouteOnly && bestTrip && <ArrowRight size={20} strokeWidth={2.5} />}
                </button>

                {/* View all buses */}
                <button
                  type="button"
                  onClick={handleViewAllBuses}
                  style={{
                    width: "100%", height: 52, borderRadius: 18,
                    border: "1.5px solid #009849", background: "white",
                    color: "#009849", fontWeight: 800, fontSize: 15, fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f0fdf4"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
                >
                  <BusFront size={20} color="#009849" />
                  {showAllBuses ? "Hide buses" : "View all buses"}
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={onReSearchRoutes}
                  disabled={!pickup || !destination || loading}
                  style={{
                    width: "100%", height: 44, borderRadius: 18,
                    border: "1px solid #e5e7eb", background: "white",
                    color: "#6b7280", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    cursor: !pickup || !destination || loading ? "not-allowed" : "pointer",
                    opacity: !pickup || !destination || loading ? 0.5 : 1,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { if (pickup && destination && !loading) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
                >
                  <RefreshCw size={15} className={loading ? "prl-animate-spin" : ""} />
                  Refresh Routes
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
