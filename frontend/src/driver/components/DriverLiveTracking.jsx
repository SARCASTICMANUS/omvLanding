import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { lerp, lerpCoords, getBearing, lngLatToWorld } from "../../maps/utils/threeHelpers";
import {
  AlertTriangle,
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
  ArrowLeft,
  Box,
  Globe,
} from "lucide-react";
import {
  getDistance,
  getStopLngLat,
} from "../../components/map/utils/routeGeometry";
import MobileBackButton from "../../components/Layout/MobileBackButton";


/* ─────────────────────────────────────────────────────────────────────────────
   1. Sub-components (Moved Outside to prevent remounting)
   ───────────────────────────────────────────────────────────────────────────── */

const MapControls = ({
  mapRef,
  is3D,
  setIs3D,
  isSatellite,
  setIsSatellite,
  currentPos,
}) => (
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
        className={`w-9 h-9 rounded-lg border flex items-center justify-center shadow-sm transition-colors cursor-pointer ${active
          ? "bg-[#009849] border-[#009849] text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
      >
        <Icon size={16} />
      </button>
    ))}
  </div>
);

const BusHeader = ({ t, compact = false }) => (
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

const Stats = ({ t }) => (
  <div className="flex items-center divide-x divide-gray-100">
    {[
      { Icon: Users, label: "Boarded", val: t.stats.boarded, green: false },
      {
        Icon: Gauge,
        label: "Speed",
        val: `${t.stats.speed} km/h`,
        green: true,
      },
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

const LiveMap = React.memo(function LiveMap({
  path,
  currentPos,
  is3D,
  isSatellite,
  mapRef,
}) {
  const mapContainer = useRef(null);
  const isInitialized = useRef(false);
  const markers = useRef({});
  const prevPos = useRef(null);

  // Initialize Map Instance
  useEffect(() => {
    if (isInitialized.current) return;
    
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: currentPos || (path && path[0]) || [77.209, 28.6139],
      zoom: 16,
      pitch: is3D ? 60 : 0,
      bearing: 0,
      antialias: true,
    });

    mapRef.current.on('load', () => {
      // Add route line
      mapRef.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: path || [] }
        }
      });
      mapRef.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#009849', 'line-width': 8, 'line-opacity': 0.6 }
      });
      
      // Satellite source setup
      mapRef.current.addSource('satellite', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256
      });
      mapRef.current.addLayer({
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: isSatellite ? 'visible' : 'none' }
      }, 'route'); 
      
      if (path && path.length > 0) {
        const bounds = new maplibregl.LngLatBounds(path[0], path[0]);
        path.forEach(p => bounds.extend(p));
        mapRef.current.fitBounds(bounds, { padding: 50 });
      }
      isInitialized.current = true;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        isInitialized.current = false;
      }
    };
  }, []); // Only on mount

  // Update logic
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Update 3D/Satellite View
    map.easeTo({ pitch: is3D ? 60 : 0, duration: 1000 });
    if (map.getLayer('satellite')) {
      map.setLayoutProperty('satellite', 'visibility', isSatellite ? 'visible' : 'none');
    }

    // Sync route path updates
    if (path) {
      const source = map.getSource('route');
      if (source) {
        source.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: path }
        });
      }
    }

    // Sync markers and vehicle position
    if (currentPos) {
      let bearing = 0;
      if (prevPos.current) {
        const [lon1, lat1] = prevPos.current;
        const [lon2, lat2] = currentPos;
        if (lon1 !== lon2 || lat1 !== lat2) {
          const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
          const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
          bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
        }
      }
      prevPos.current = currentPos;

      if (!markers.current.bus) {
        const el = document.createElement('div');
        el.className = 'bus-marker-container';
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
        markers.current.bus = new maplibregl.Marker({ element: el }).setLngLat(currentPos).addTo(map);
      } else {
        markers.current.bus.setLngLat(currentPos);
      }

      const model = markers.current.bus.getElement().querySelector('.bus-model');
      if (model) model.style.transform = `rotate(${bearing}deg)`;

      map.easeTo({ center: currentPos, bearing: is3D ? bearing : 0, duration: 1500, zoom: is3D ? 17 : 15 });
    }

    // Destination Marker
    if (path && path.length > 0) {
      const dest = path[path.length - 1];
      if (!markers.current.dest) {
        const el = document.createElement('div');
        el.className = 'flex items-center justify-center bg-red-500 text-white w-8 h-8 rounded-full border-2 border-white shadow-lg';
        el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
        markers.current.dest = new maplibregl.Marker({ element: el }).setLngLat(dest).addTo(map);
      } else {
        markers.current.dest.setLngLat(dest);
      }
    }
  }, [currentPos, path, is3D, isSatellite]);

  return <div ref={mapContainer} className="w-full h-full block relative" />;
});

/* ─────────────────────────────────────────────────────────────────────────────
   2. Layout Views (Moved outside and passed props)
   ───────────────────────────────────────────────────────────────────────────── */

const MobileView = ({
  onBack,
  t,
  currentPos,
  is3D,
  setIs3D,
  isSatellite,
  setIsSatellite,
  mapRef,
  displayNextStop,
}) => (
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
    <BusHeader t={t} compact />
    <div className="relative flex-1 bg-slate-200">
      <LiveMap
        path={t.path}
        currentPos={currentPos}
        is3D={is3D}
        isSatellite={isSatellite}
        mapRef={mapRef}
      />
      <MapControls
        mapRef={mapRef}
        is3D={is3D}
        setIs3D={setIs3D}
        isSatellite={isSatellite}
        setIsSatellite={setIsSatellite}
        currentPos={currentPos}
      />
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
            {displayNextStop.eta}{" "}
            <span className="text-sm font-medium">min</span>
          </p>
        </div>
      </div>
      <Stats t={t} />
    </div>
  </div>
);

const DesktopView = ({
  t,
  currentPos,
  is3D,
  setIs3D,
  isSatellite,
  setIsSatellite,
  mapRef,
  displayNextStop,
  user,
}) => (
  <div className="flex flex-col h-screen bg-gray-50">
    <div className="flex gap-6 p-6 items-start flex-1 overflow-hidden">
      <aside className="w-80 flex-shrink-0 flex flex-col gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">Next Stop</p>
          <p className="text-2xl font-black text-gray-900 leading-tight">
            {displayNextStop.name}
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
          <Stats t={t} />
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
        <BusHeader t={t} />
        <div className="relative flex-1 bg-slate-200">
          <LiveMap
            path={t.path}
            currentPos={currentPos}
            is3D={is3D}
            isSatellite={isSatellite}
            mapRef={mapRef}
          />
          <MapControls
            mapRef={mapRef}
            is3D={is3D}
            setIs3D={setIs3D}
            isSatellite={isSatellite}
            setIsSatellite={setIsSatellite}
            currentPos={currentPos}
          />
        </div>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Main export — Driver Tracking Dashboard
   ───────────────────────────────────────────────────────────────────────────── */

export default function DriverLiveTracking({ route, activeTrip, onBack }) {
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const mapRef = useRef(null);
  const lastSentRef = useRef(0);
  // Set 3D default to true
  const [is3D, setIs3D] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);

  // Responsive state
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : true,
  );

  const [currentPos, setCurrentPos] = useState(
    activeTrip.currentPos || activeTrip.previewPath?.[0] || null,
  );
  const [speed, setSpeed] = useState(0);
  const [liveData, setLiveData] = useState(null);

  // 1. WebSocket Setup
  const { send } = useSocketSubscription({
    key: `trip-${activeTrip.id}`,
    path: API_PATHS.sockets.trip(activeTrip.id, token, "driver"),
    enabled: !!activeTrip.id && !!token,
    onMessage: (message) => {
      // If the backend says the trip is stopped or stale, kick the driver out
      if (message.type === "vehicle_stopped") {
        // Only alert and redirect if it's NOT just a socket flicker
        // (Backend now handles this more gracefully, but we check just in case)
        if (
          message.reason === "trip_not_active" ||
          message.reason === "trip_not_found"
        ) {
          alert("This trip session has ended.");
          onBack();
        }
      }

      if (message.type === "v_delta" || message.type === "vehicle_update") {
        setLiveData(message);
      }
    },
  });

  // 2. Real Geolocation Tracking
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const {
          latitude,
          longitude,
          heading,
          speed: currentSpeed,
        } = position.coords;
        const newPos = [longitude, latitude];

        setCurrentPos(newPos);
        setSpeed(Math.round((currentSpeed || 0) * 3.6)); // Convert m/s to km/h
        const now = Date.now();

        // PUSH TO SERVER via WebSocket (Flat structure)
        if (now - lastSentRef.current >= 5000) {
          lastSentRef.current = now;
          send({
            trip_id: activeTrip.id,
            lat: latitude,
            lon: longitude,
            heading: heading || 0,
            speed: currentSpeed || 0,
          });
        }
      },
      (error) => console.error("Location error:", error),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrip.id]);

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
      status:
        activeTrip.status_label ||
        (liveData?.delay_minutes > 5
          ? `${liveData.delay_minutes}m Delayed`
          : "On Time"),
      route: {
        from: activeTrip.startLabel || "--",
        to: activeTrip.endLabel || "--",
      },
      stats: {
        boarded:
          activeTrip.passenger_count ?? activeTrip.boarded_passengers ?? 0,
        speed: speed,
        traffic: activeTrip.traffic_status || "Light",
      },
      summary: {
        totalDistance: activeTrip.distanceText || "--",
        estimatedTime: activeTrip.durationText || "--",
        totalStops: activeTrip.stopsCount || activeTrip.stops?.length || 0,
        vehicleNo: activeTrip.vehicleNumber || activeTrip.bus_number || "--",
      },
      path,
      stops: activeTrip.stops || [],
    };
  }, [activeTrip, speed, liveData]);

  const displayNextStop = useMemo(() => {
    if (liveData?.next_stop_eta?.length > 0) {
      const next = liveData.next_stop_eta[0];
      return {
        name: next.stop_name,
        distance:
          next.distance_meters > 1000
            ? `${(next.distance_meters / 1000).toFixed(1)} km`
            : `${Math.round(next.distance_meters)} m`,
        eta: Math.max(1, Math.round(next.duration_seconds / 60)),
      };
    }

    // Basic fallback logic
    const next = t.stops[1] || t.stops[0];
    return {
      name: next?.name || "End of Route",
      distance: "Calculating...",
      eta: "--",
    };
  }, [t.stops, liveData]);

  /* ── Error State ── */
  if (!activeTrip) {
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
        <div className="w-10 h-10" />
        <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-gray-200 bg-gray-50">
          <span className="w-2 h-2 rounded-full bg-[#009849]" />
          <span className="text-xs font-bold text-[#009849]">ONLINE</span>
        </div>
        <button className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center"><Bell size={20} /></button>
      </div>
      <BusHeader compact />
      <div className="relative flex-1 bg-slate-200">
        <LiveMap path={t.path} currentPos={currentPos} is3D={is3D} isSatellite={isSatellite} mapRef={mapRef} />
        <MapControls />
      </div>
      <div className="bg-white border-t border-gray-100 px-4 pt-4 pb-6">
        <div className="flex items-center gap-6 mb-4">
          <div className="flex-1"><p className="text-xs text-gray-400">Next Stop</p><p className="text-lg font-black">{displayNextStop.name}</p></div>
          <div className="flex-shrink-0 text-right"><p className="text-xs text-gray-400">ETA</p><p className="text-3xl font-black text-[#009849]">{displayNextStop.eta} <span className="text-sm font-medium">min</span></p></div>
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
            <p className="text-2xl font-black text-gray-900 leading-tight">{displayNextStop.name}</p>
            <p className="text-sm text-gray-500 mt-1">{displayNextStop.distance} away</p>
            <div className="h-px bg-gray-100 my-4" />
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-[#009849]">{displayNextStop.eta}</span>
              <span className="text-lg font-medium text-gray-700">min</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <Stats />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { Icon: MapPin, label: "Total Distance", val: t.summary.totalDistance },
              { Icon: Clock, label: "Estimated Time", val: t.summary.estimatedTime },
              { Icon: Users, label: "Total Stops", val: t.summary.totalStops },
              { Icon: Car, label: "Vehicle No.", val: t.summary.vehicleNo },
            ].map(({ Icon, label, val }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 px-2 bg-white rounded-xl border border-gray-100 text-center">
                <Icon size={18} className="text-[#009849]" />
                <span className="text-[10px] text-gray-400 uppercase">{label}</span>
                <span className="text-xs font-black text-gray-800">{val}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto">
             <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Active Driver</p>
                <p className="text-sm font-black text-slate-800">{user?.name || "Driver Console"}</p>
             </div>
          </div>
        </aside>
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm h-full">
          <BusHeader />
          <div className="relative flex-1 bg-slate-200">
            <LiveMap path={t.path} currentPos={currentPos} is3D={is3D} isSatellite={isSatellite} mapRef={mapRef} />
            <MapControls />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans">
      {isMobile && <MobileBackButton onClick={onBack} />}
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  );
}
