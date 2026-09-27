import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector } from "react-redux";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  TriangleAlert,
  Users,
  Gauge,
  Zap,
  MapPin,
  Bike,
  CarFront,
  Plus,
  Minus,
  Crosshair,
  Box,
  Globe,
} from "lucide-react";
import { API_PATHS } from "../../constants/apiPaths";
import { useSocketSubscription } from "../../hooks/useSocketSubscription";
import {
  VayyButton,
  BottomSheet,
  StatusBadge,
  LiveDot,
  RouteLine,
} from "../../components/vayy";

/* Full-viewport flush shell: covers the fixed tab bar, clears the 72px
   desktop top nav on lg+. Single responsive layout (no JS breakpoints). */
const SHELL = "fixed inset-0 z-overlay overflow-hidden font-sans lg:top-[72px]";

const chipClass =
  "inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-v-elev";

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
}) => {
  const baseClass =
    "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition hover:bg-gray-50 active:scale-95";
  const activeClass =
    "bg-[#009849] text-white shadow-[0_6px_16px_rgba(0,152,73,0.35)] hover:bg-[#007A3B]";
  return (
    <>
      <button
        type="button"
        aria-label="Zoom in"
        className={baseClass}
        onClick={() => mapRef.current?.zoomIn()}
      >
        <Plus size={22} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        className={baseClass}
        onClick={() => mapRef.current?.zoomOut()}
      >
        <Minus size={22} strokeWidth={2.5} />
      </button>
      <button
        type="button"
        aria-label="3D View"
        className={`${baseClass} ${is3D ? activeClass : ""}`}
        onClick={() => setIs3D(!is3D)}
      >
        <Box size={20} strokeWidth={2.4} />
      </button>
      <button
        type="button"
        aria-label="Satellite"
        className={`${baseClass} ${isSatellite ? activeClass : ""}`}
        onClick={() => setIsSatellite(!isSatellite)}
      >
        <Globe size={20} strokeWidth={2.4} />
      </button>
      <button
        type="button"
        aria-label="My location"
        className={baseClass}
        onClick={() => {
          if (currentPos)
            mapRef.current?.easeTo({ center: currentPos, zoom: 17, pitch: 60 });
        }}
      >
        <Crosshair size={20} strokeWidth={2.4} />
      </button>
    </>
  );
};

const Stats = ({ t }) => (
  <div className="grid grid-cols-3 border-y border-[#E5E7EB] py-3">
    {[
      { Icon: Users, label: "Boarded", val: t.stats.boarded },
      { Icon: Gauge, label: "Speed", val: `${t.stats.speed} km/h` },
      { Icon: Zap, label: "Traffic", val: t.stats.traffic },
    ].map((entry) => {
      const { Icon, label, val } = entry;
      return (
        <div
          key={label}
          className="flex flex-col items-center gap-1 px-1 text-center"
        >
          <Icon size={16} className="text-[#009849]" />
          <span className="text-[18px] font-black leading-none text-[#009849]">
            {val}
          </span>
          <span className="text-[11px] font-bold leading-none text-[#6B7280]">
            {label}
          </span>
        </div>
      );
    })}
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
        el.className = 'vehicle-marker-container';
        const vehicleIcon = (activeTrip?.vehicle_type || activeTrip?.vehicle?.vehicle_type) === 'bike'
          ? '<circle cx="6" cy="17" r="3"></circle><circle cx="18" cy="17" r="3"></circle><path d="m9 17 3-8 4 8H9l-3-7h5m1-2h3"></path>'
          : '<path d="M3 16V9l2-4h14l2 4v7"></path><path d="M3 11h18M5 16h14M6 16v3m12-3v3"></path><circle cx="7" cy="15" r="1"></circle><circle cx="17" cy="15" r="1"></circle>';
        el.innerHTML = `
          <div class="relative w-16 h-16 flex items-center justify-center">
            <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
            <div class="vehicle-model relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white bg-emerald-600 text-white shadow-2xl transition-transform duration-1000">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${vehicleIcon}</svg>
            </div>
          </div>
        `;
        markers.current.bus = new maplibregl.Marker({ element: el }).setLngLat(currentPos).addTo(map);
      } else {
        markers.current.bus.setLngLat(currentPos);
      }

      const model = markers.current.bus.getElement().querySelector('.vehicle-model');
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
   Main export — Driver Tracking Dashboard
   ───────────────────────────────────────────────────────────────────────────── */

export default function DriverLiveTracking({ activeTrip, onBack, onEndTrip }) {
  const user = useSelector((state) => state.auth?.user);
  const token = useSelector((state) => state.auth?.token);
  const mapRef = useRef(null);
  const lastSentRef = useRef(0);
  const sheetContentRef = useRef(null);
  // Set 3D default to true
  const [is3D, setIs3D] = useState(true);
  const [isSatellite, setIsSatellite] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);

  const [currentPos, setCurrentPos] = useState(
    activeTrip?.currentPos || activeTrip?.previewPath?.[0] || null,
  );
  const [speed, setSpeed] = useState(0);
  const [liveData, setLiveData] = useState(null);

  const vehicleId =
    activeTrip?.vehicle?.id || activeTrip?.vehicle_id || activeTrip?.vehicleId || null;
  const wsToken =
    token ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null);

  // 1. WebSocket Setup — driver location channel (parity with mobile:
  //    vayy_app DriverLiveTracking subscribes to WS.trackingVehicle)
  const { send } = useSocketSubscription({
    key: `vehicle-${vehicleId}`,
    path: vehicleId && wsToken ? API_PATHS.sockets.vehicle(vehicleId, wsToken) : null,
    enabled: !!vehicleId && !!wsToken,
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

      if (message.type === "v_delta" || message.type === "vehicle_update" || message.type === "trip_update") {
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
            type: "location_update",
            trip_id: activeTrip?.id,
            lat: latitude,
            lon: longitude,
            heading: heading || 0,
            speed: Math.max(0, Math.round((currentSpeed || 0) * 3.6)),
          });
        }
      },
      (error) => console.error("Location error:", error),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeTrip?.id, send]);

  // Keep the floating zoom controls docked above the bottom sheet
  useEffect(() => {
    const content = sheetContentRef.current;
    const sheet = content ? content.parentElement : null;
    if (!sheet || typeof ResizeObserver === "undefined") return undefined;

    const update = () => setSheetHeight(sheet.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    update();
    return () => observer.disconnect();
  }, [activeTrip]);

  // Data normalization
  const t = useMemo(() => {
    const trip = activeTrip || {};
    const path = trip.previewPath || [];
    return {
      vehicleLabel:
        trip.vehicle_number ||
        trip.vehicleNumber ||
        trip.vehicle_id ||
        "Your ride",
      vehicleType: trip.vehicle_type || trip.vehicle?.vehicle_type || "auto",
      status:
        trip.status_label ||
        (liveData?.delay_minutes > 5
          ? `${liveData.delay_minutes}m Delayed`
          : "On Time"),
      route: {
        from: trip.startLabel || "--",
        to: trip.endLabel || "--",
      },
      stats: {
        boarded:
          trip.passenger_count ?? trip.boarded_passengers ?? 0,
        speed: speed,
        traffic: trip.traffic_status || "Light",
      },
      summary: {
        totalDistance: trip.distanceText || "--",
        estimatedTime: trip.durationText || "--",
        totalStops: trip.stopsCount || trip.stops?.length || 0,
        vehicleNo: trip.vehicle_number || trip.vehicleNumber || "--",
      },
      path,
      stops: trip.stops || [],
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

  // Trip progress (mobile AutoLiveTracking progressBar parity)
  const routeProgress = useMemo(() => {
    if (liveData?.route_progress != null) {
      const raw = Number(liveData.route_progress);
      if (Number.isFinite(raw)) {
        return Math.max(0, Math.min(100, raw > 1 ? raw : raw * 100));
      }
    }
    if (!t.stops.length) return 0;
    const index = t.stops.findIndex(
      (stop) => (stop?.name || stop?.stop_name) === displayNextStop.name,
    );
    const reached = index > -1 ? index : 0;
    return Math.round((reached / Math.max(t.stops.length - 1, 1)) * 100);
  }, [liveData, t.stops, displayNextStop.name]);

  const handleEndTrip = () => {
    if (typeof onEndTrip === "function") onEndTrip();
    else onBack();
  };

  /* ── Error State ── */
  if (!activeTrip) {
    return (
      <div
        className={`${SHELL} flex flex-col items-center justify-center gap-4 bg-white px-6 text-center`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEF2F2]">
          <TriangleAlert size={28} className="text-[#EF4444]" />
        </div>
        <div>
          <h2 className="text-[20px] font-black text-[#111827]">
            Tracking Unavailable
          </h2>
          <p className="mt-2 text-sm font-medium text-[#6B7280]">
            Live trip data could not be loaded for this session.
          </p>
        </div>
        <VayyButton variant="primary" size="md" onClick={onBack}>
          Return to Review
        </VayyButton>
      </div>
    );
  }

  const delayed = /delayed/i.test(String(t.status));

  return (
    <div className={SHELL}>
      {/* Full-screen MapLibre map */}
      <div className="absolute inset-0 bg-slate-200">
        <LiveMap
          path={t.path}
          currentPos={currentPos}
          is3D={is3D}
          isSatellite={isSatellite}
          mapRef={mapRef}
        />
      </div>

      {/* Top floating chrome: back + vehicle header chip + HUD chips */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-overlay px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mx-auto flex w-full max-w-[560px] items-center gap-2 sm:gap-3 lg:max-w-[720px]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="pointer-events-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-v-elev transition hover:bg-gray-50 active:scale-95"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>

          <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-between gap-3 rounded-v-lg bg-white px-4 py-3 shadow-v-md">
            <div className="min-w-0">
              <p className="truncate text-[18px] font-black leading-tight text-[#111827]">
                {t.vehicleType === "bike" ? "Bike" : "Auto"} · {t.vehicleLabel}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">
                <span className="font-semibold text-[#374151]">Route:</span>{" "}
                <span className="text-[#009849]">{t.route.from}</span>
                {" → "}
                {t.route.to}
              </p>
            </div>
            <StatusBadge
              tone={delayed ? "warning" : "success"}
              className="shrink-0 whitespace-nowrap"
            >
              {t.status}
            </StatusBadge>
          </div>
        </div>

        {/* Speed / next-stop HUD + live status pill */}
        <div className="mx-auto mt-2 flex w-full max-w-[560px] flex-wrap items-center gap-2 lg:max-w-[720px]">
          <span className={chipClass}>
            <Gauge size={14} className="text-[#009849]" />
            <span className="text-[12px] font-extrabold text-[#111827]">
              {t.stats.speed} km/h
            </span>
          </span>

          <span className={`${chipClass} min-w-0 flex-1 sm:flex-none`}>
            <MapPin size={14} className="shrink-0 text-[#009849]" />
            <span className="truncate text-[12px] font-bold text-[#374151]">
              {displayNextStop.name}
            </span>
            <span className="shrink-0 text-[12px] font-black text-[#009849]">
              {displayNextStop.eta} min
            </span>
          </span>

          <span className={chipClass}>
            <LiveDot size={10} />
            <span className="text-[11px] font-black uppercase tracking-wide text-[#007A3B]">
              Live
            </span>
          </span>
        </div>
      </div>

      {/* Zoom / view controls (42px white circles), docked above the sheet */}
      <div
        className="absolute right-4 z-overlay flex flex-col gap-2.5"
        style={{ bottom: sheetHeight + 16 }}
      >
        <MapControls
          mapRef={mapRef}
          is3D={is3D}
          setIs3D={setIs3D}
          isSatellite={isSatellite}
          setIsSatellite={setIsSatellite}
          currentPos={currentPos}
        />
      </div>

      {/* Bottom sheet: trip progress / passengers / controls / End Trip */}
      <BottomSheet className="max-h-[64dvh] overflow-y-auto">
        <div ref={sheetContentRef} className="space-y-4">
          {/* Next stop + ETA (mobile panel) */}
          <div>
            <p className="text-[12px] font-black uppercase tracking-wider text-[#6B7280]">
              Next Stop
            </p>
            <p className="mt-1 truncate text-[24px] font-black leading-tight text-[#111827]">
              {displayNextStop.name}
            </p>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              {displayNextStop.distance}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[48px] font-black leading-none text-[#009849]">
                {displayNextStop.eta}
              </span>
              <span className="text-[18px] font-black text-[#009849]">min</span>
            </div>
          </div>

          {/* Trip progress */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-extrabold text-[#374151]">
                Boarded
              </span>
              <span className="text-[11px] font-black text-[#009849]">
                {Math.round(routeProgress)}% complete
              </span>
              <span className="text-[11px] font-extrabold text-[#374151]">
                Drop-off
              </span>
            </div>
            <RouteLine
              progress={routeProgress}
              knobIcon={t.vehicleType === "bike" ? <Bike size={14} className="text-[#009849]" /> : <CarFront size={14} className="text-[#009849]" />}
            />
          </div>

          {/* Passengers / speed / traffic */}
          <Stats t={t} />

          {/* Active driver */}
          <div className="flex items-center gap-3 rounded-v-md bg-[#E0F5E8] px-3 py-2.5">
            <LiveDot size={10} />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#007A3B]">
                Active Driver
              </p>
              <p className="truncate text-[13px] font-extrabold text-[#111827]">
                {user?.name || "Driver Console"}
              </p>
            </div>
          </div>

          {/* Controls */}
          <VayyButton fullWidth size="lg" onClick={() => undefined}>
            Start Announcement
          </VayyButton>
          <VayyButton fullWidth variant="outline" onClick={() => undefined}>
            Call Control Room
          </VayyButton>
          <VayyButton fullWidth variant="outline" onClick={() => undefined}>
            Report Issue
          </VayyButton>
          <VayyButton fullWidth size="lg" onClick={handleEndTrip}>
            End Trip
          </VayyButton>

          {/* Reserve room for DriverFlow's floating End Ride action */}
          <div className="h-12" />
        </div>
      </BottomSheet>
    </div>
  );
}
