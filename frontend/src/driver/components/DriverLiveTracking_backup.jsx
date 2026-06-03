import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  AlertTriangle,
  Volume2,
  Phone,
  TriangleAlert,
  Users,
  Gauge,
  Zap,
  MapPin,
  Bus,
  Clock,
  Car,
  Plus,
  Minus,
  Crosshair,
  Bell,
  Menu,
  Route,
  ArrowLeft,
  Box,
  Globe,
} from "lucide-react";
import {
  getDistance,
  getStopLngLat,
} from "../../components/map/utils/routeGeometry";
import { useSocketSubscription } from "../../hooks/useSocketSubscription";
import { API_PATHS } from "../../constants/apiPaths";

/* ─────────────────────────────────────────────────────────────────────────────
   Real Map Implementation using MapLibre
   ───────────────────────────────────────────────────────────────────────────── */
// function LiveMap({ path, currentPos, is3D, isSatellite, mapRef }) {
const LiveMap = React.memo(function LiveMap({
  path,
  currentPos,
  is3D,
  isSatellite,
  mapRef,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const prevPos = useRef(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: currentPos || (path && path[0]) || [77.209, 28.6139],
      zoom: 16,
      pitch: is3D ? 60 : 0,
      bearing: 0,
    });

    if (mapRef) mapRef.current = map.current;

    map.current.on("load", () => {
      // Add route line
      if (!map.current.getSource("route")) {
        map.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: path || [] },
          },
        });
        map.current.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#009849",
            "line-width": 8,
            "line-opacity": 0.6,
          },
        });
      }

      // Satellite source setup
      if (!map.current.getSource("satellite")) {
        map.current.addSource("satellite", {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
        });
        map.current.addLayer(
          {
            id: "satellite",
            type: "raster",
            source: "satellite",
            layout: { visibility: isSatellite ? "visible" : "none" },
          },
          "route",
        );
      }

      if (path && path.length > 0) {
        const bounds = new maplibregl.LngLatBounds(path[0], path[0]);
        path.forEach((p) => bounds.extend(p));
        map.current.fitBounds(bounds, { padding: 50 });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Sync 3D/Satellite View
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    map.current.easeTo({
      pitch: is3D ? 60 : 0,
      duration: 1000,
    });

    if (map.current.getLayer("satellite")) {
      map.current.setLayoutProperty(
        "satellite",
        "visibility",
        isSatellite ? "visible" : "none",
      );
    }
  }, [is3D, isSatellite]);

  // Sync route path updates
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !path) return;
    const source = map.current.getSource("route");
    if (source) {
      source.setData({
        type: "Feature",
        geometry: { type: "LineString", coordinates: path },
      });
    }
  }, [path]);

  // Sync markers and vehicle position
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Bus Marker logic
    if (currentPos) {
      let bearing = 0;
      if (prevPos.current) {
        const [lon1, lat1] = prevPos.current;
        const [lon2, lat2] = currentPos;
        if (lon1 !== lon2 || lat1 !== lat2) {
          // Standard bearing calculation
          const y =
            Math.sin(((lon2 - lon1) * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180);
          const x =
            Math.cos((lat1 * Math.PI) / 180) *
              Math.sin((lat2 * Math.PI) / 180) -
            Math.sin((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.cos(((lon2 - lon1) * Math.PI) / 180);
          bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
        }
      }
      prevPos.current = currentPos;

      if (!markers.current.bus) {
        const el = document.createElement("div");
        el.className = "bus-marker-container";
        el.innerHTML = `
          <div class="relative w-16 h-16 flex items-center justify-center">
            <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
            <div class="bus-model relative bg-emerald-600 w-7 h-12 rounded-lg border-2 border-white shadow-2xl flex flex-col items-center overflow-hidden transition-transform duration-1000">
              <div class="w-full h-2 bg-emerald-400 mb-1"></div>
              <div class="w-5 h-4 bg-white/40 rounded-sm"></div>
              <div class="mt-auto w-full h-1.5 bg-emerald-900/40"></div>
            </div>
          </div>
        `;
        markers.current.bus = new maplibregl.Marker({ element: el })
          .setLngLat(currentPos)
          .addTo(map.current);
      } else {
        markers.current.bus.setLngLat(currentPos);
      }

      const model = markers.current.bus
        .getElement()
        .querySelector(".bus-model");
      if (model) {
        model.style.transform = `rotate(${bearing}deg)`;
      }

      // Smooth camera follow
      map.current.easeTo({
        center: currentPos,
        bearing: is3D ? bearing : 0,
        duration: 1500,
        zoom: is3D ? 17 : 15,
      });
    }

    // Destination Marker logic
    if (path && path.length > 0) {
      const dest = path[path.length - 1];
      if (!markers.current.dest) {
        const el = document.createElement("div");
        el.className =
          "flex items-center justify-center bg-red-500 text-white w-8 h-8 rounded-full border-2 border-white shadow-lg";
        el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
        markers.current.dest = new maplibregl.Marker({ element: el })
          .setLngLat(dest)
          .addTo(map.current);
      } else {
        markers.current.dest.setLngLat(dest);
      }
    }
  }, [currentPos, path, is3D]);

  return <div ref={mapContainer} className="w-full h-full block relative" />;
});

/* ── Sub-components ── */
const MapControls = () => (
  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-10">
    {[
      { Icon: Plus, label: "Zoom in", onClick: () => mapRef.current?.zoomIn() },
      {
        Icon: Minus,
        label: "Zoom out",
        onClick: () => mapRef.current?.zoomOut(),
      },
      {
        Icon: Box,
        label: "3D View",
        onClick: () => setIs3D(!is3D),
        active: is3D,
      },
      {
        Icon: Globe,
        label: "Satellite",
        onClick: () => setIsSatellite(!isSatellite),
        active: isSatellite,
      },
      {
        Icon: Crosshair,
        label: "My location",
        onClick: () => {
          if (currentPos)
            mapRef.current?.easeTo({ center: currentPos, zoom: 17, pitch: 60 });
        },
      },
    ].map(({ Icon, label, onClick, active }) => (
      <button
        key={label}
        onClick={onClick}
        className={`w-9 h-9 rounded-lg border flex items-center justify-center shadow-sm transition-colors cursor-pointer ${
          active
            ? "bg-[#009849] border-[#009849] text-white"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
        }`}
      >
        <Icon size={16} />
      </button>
    ))}
  </div>
);

const BusHeader = ({ compact = false }) => (
  <div
    className={`flex items-center gap-3 bg-white border-b border-gray-100 ${compact ? "px-4 py-3" : "px-5 py-4"}`}
  >
    <div
      className={`flex items-center justify-center rounded-xl bg-green-50 flex-shrink-0`}
      style={{ width: compact ? 44 : 52, height: compact ? 44 : 52 }}
    >
      <Bus size={compact ? 22 : 28} className="text-[#009849]" />
    </div>
    <div className="flex-1 min-w-0">
      <p
        className={`font-black text-gray-900 leading-tight ${compact ? "text-[17px]" : "text-xl"}`}
      >
        Bus {t.busId}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        <span className="font-semibold text-gray-700">Route:</span>{" "}
        <span className="text-[#009849]">{t.route.from}</span>
        {" → "}
        {t.route.to}
      </p>
    </div>
    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#009849] px-3 py-1.5 rounded-full border border-green-300 bg-green-50 whitespace-nowrap flex-shrink-0">
      {!compact && (
        <span className="w-2 h-2 rounded-full bg-[#009849] inline-block" />
      )}
      {t.status}
    </div>
  </div>
);

const Stats = () => (
  <div className="flex items-center divide-x divide-gray-100">
    {[
      { Icon: Users, label: "Boarded", val: t.stats.boarded, green: false },
      { Icon: Gauge, label: "Speed", val: `45 km/h`, green: true },
      { Icon: Zap, label: "Traffic", val: t.stats.traffic, green: true },
    ].map(({ Icon, label, val, green }) => (
      <div
        key={label}
        className="flex-1 flex flex-col items-center gap-1 py-3 px-2"
      >
        <Icon size={16} className="text-gray-400" />
        <span className="text-[11px] text-gray-400 text-center">{label}</span>
        <span
          className={`text-[15px] font-bold leading-none ${green ? "text-[#009849]" : "text-gray-900"}`}
        >
          {val}
        </span>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Main export — Driver Tracking Dashboard
   ───────────────────────────────────────────────────────────────────────────── */
export default function DriverLiveTracking({ route, activeTrip, onBack }) {
  const user = useSelector((state) => state.auth?.user);
  const mapRef = useRef(null);

  // Set 3D default to true
  const [is3D, setIs3D] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);

  // Responsive state
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : true,
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Data normalization
  const t = useMemo(() => {
    const path = activeTrip.previewPath || [];
    return {
      busId:
        activeTrip.bus_number ||
        activeTrip.vehicleNumber ||
        activeTrip.vehicle_id ||
        "VAYY-LIVE",
      status: activeTrip.status_label || "On Time",
      route: {
        from: activeTrip.startLabel || "--",
        to: activeTrip.endLabel || "--",
      },
      nextStop: {
        name:
          activeTrip.next_stop_name ||
          activeTrip.stops?.[1]?.name ||
          "Upcoming Stop",
        distance: activeTrip.next_stop_distance_text || "Checking...",
        eta: activeTrip.next_stop_eta_minutes || "--",
      },
      stats: {
        boarded:
          activeTrip.passenger_count ?? activeTrip.boarded_passengers ?? 0,
        speed: activeTrip.current_speed ?? 0,
        traffic: activeTrip.traffic_status || "Light",
      },
      summary: {
        totalDistance: activeTrip.distanceText || "--",
        estimatedTime: activeTrip.durationText || "--",
        totalStops: activeTrip.stopsCount || 0,
        vehicleNo: activeTrip.vehicleNumber || activeTrip.bus_number || "--",
      },
      path,
      currentPos: activeTrip.currentPos || path[0] || null,
      stops: activeTrip.stops || [],
    };
  }, [activeTrip]);

  const [currentPos, setCurrentPos] = useState(t.currentPos);
  const [simulatedStopIndex, setSimulatedStopIndex] = useState(0);
  const [simulatedDistance, setSimulatedDistance] = useState("--");

  // Simulation for all trips in LIVE view to show movement
  useEffect(() => {
    if (t.path.length > 0) {
      let idx = 0;
      let lastStopIdx = 0;

      const interval = setInterval(() => {
        idx = idx + 1;
        if (idx >= t.path.length) {
          clearInterval(interval);
          return;
        }

        const pos = t.path[idx];
        setCurrentPos(pos);

        // Update stop logic
        const stops = t.stops;
        if (stops.length > 0) {
          const nextStop = stops[lastStopIdx + 1];
          if (nextStop) {
            const stopCoord = getStopLngLat(nextStop);
            if (stopCoord) {
              const dist = getDistance(pos, stopCoord);
              setSimulatedDistance(
                dist >= 1000
                  ? `${(dist / 1000).toFixed(1)} km`
                  : `${Math.round(dist)} m`,
              );

              if (dist < 100) {
                lastStopIdx++;
                setSimulatedStopIndex(lastStopIdx);
              }
            }
          }
        }
      }, 2000); // Steady movement for the simulation
      return () => clearInterval(interval);
    }
  }, [t.path, t.stops]);

  const displayNextStop = useMemo(() => {
    const next = t.stops[simulatedStopIndex + 1] || t.stops[t.stops.length - 1];
    return {
      name: next?.name || "End of Route",
      distance: simulatedDistance,
      eta: Math.max(1, 15 - simulatedStopIndex), // Dummy simulated ETA
    };
  }, [t.stops, simulatedStopIndex, simulatedDistance]);

  /* ── Error State ── */
  if (!route || !activeTrip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
        <div>
          <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-2xl font-black">Tracking Unavailable</h2>
          <button
            onClick={onBack}
            className="mt-6 rounded-2xl bg-[#009849] px-6 py-3 font-bold"
          >
            Return to Review
          </button>
        </div>
      </div>
    );
  }

  const MobileView = () => (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-200 bg-gray-50">
          <span className="w-2 h-2 rounded-full bg-[#009849]" />
          <span className="text-xs font-bold text-[#009849]">ONLINE</span>
        </div>
        <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center">
          <Bell size={20} />
        </button>
      </div>
      <BusHeader compact />
      <div className="relative flex-1 bg-slate-200">
        <LiveMap
          path={t.path}
          currentPos={currentPos}
          is3D={is3D}
          isSatellite={isSatellite}
          mapRef={mapRef}
        />
        <MapControls />
      </div>
      <div className="bg-white border-t border-gray-100 px-4 pt-4 pb-6">
        <div className="flex items-center gap-6 mb-4">
          <div className="flex-1">
            <p className="text-xs text-gray-400">Next Stop</p>
            <p className="text-lg font-black">{displayNextStop.name}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xs text-gray-400">ETA</p>
            <p className="text-3xl font-black text-[#009849]">
              {displayNextStop?.eta}{" "}
              <span className="text-sm font-medium">min</span>
            </p>
          </div>
        </div>
        <Stats />
      </div>
    </div>
  );

  const DesktopView = () => (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex gap-6 p-6 items-start flex-1 overflow-hidden">
        <aside className="w-80 flex-shrink-0 flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Next Stop</p>
            <p className="text-2xl font-black text-gray-900 leading-tight">
              {displayNextStop?.name}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {displayNextStop.distance} away
            </p>
            <div className="h-px bg-gray-100 my-4" />
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-[#009849]">
                {displayNextStop.eta}
              </span>
              <span className="text-lg font-medium text-gray-700">min</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <Stats />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                Icon: MapPin,
                label: "Total Distance",
                val: t.summary.totalDistance,
              },
              {
                Icon: Clock,
                label: "Estimated Time",
                val: t.summary.estimatedTime,
              },
              { Icon: Users, label: "Total Stops", val: t.summary.totalStops },
              { Icon: Car, label: "Vehicle No.", val: t.summary.vehicleNo },
            ].map(({ Icon, label, val }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1 py-3 px-2 bg-white rounded-xl border border-gray-100 text-center"
              >
                <Icon size={18} className="text-[#009849]" />
                <span className="text-[10px] text-gray-400 uppercase">
                  {label}
                </span>
                <span className="text-xs font-black text-gray-800">{val}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                Active Driver
              </p>
              <p className="text-sm font-black text-slate-800">
                {user?.name || "Driver Console"}
              </p>
            </div>
          </div>
        </aside>
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm h-full">
          <BusHeader />
          <div className="relative flex-1 bg-slate-200">
            <LiveMap
              path={t.path}
              currentPos={currentPos}
              is3D={is3D}
              isSatellite={isSatellite}
              mapRef={mapRef}
            />
            <MapControls />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans">
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
