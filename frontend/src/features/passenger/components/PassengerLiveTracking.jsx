// VAYY | src/features/passenger/components/PassengerLiveTracking.jsx | Status: ✅ Map Refactor Complete
// Clean tracking view with modern map styling and reliable websocket integration.

import React, { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Bike,
  CarFront,
  ChevronLeft,
  Clock,
  Navigation,
  AlertTriangle,
  Info,
  Plus,
  Minus,
} from "lucide-react";
import api, { getWsUrl } from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import notificationService from "../../../services/notificationService";
import { getWalkingRoute } from "../../../maps/utils/routing";
import {
  VayyButton,
  BottomSheet,
  MetricChip,
  LiveDot,
} from "../../../components/vayy";

// Full-viewport flush shell: covers the fixed mobile tab bar / top bar so
// nothing hides behind them, clears the 72px desktop top nav on lg+.
const SHELL = "fixed inset-0 z-overlay font-sans lg:top-[72px]";

const PassengerLiveTracking = ({
  tripId,
  onBack,
  onTripStatus,
  rideStatus,
  showEndRide = false,
  onEndRide,
  ending = false,
  endError,
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [tripData, setTripIdData] = useState(null);
  const [busData, setBusData] = useState({ pos: null, eta: [] });
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [myPos, setMyPos] = useState(null);
  const [routeData, setRouteData] = useState(null); // Road-based route data
  const [sheetHeight, setSheetHeight] = useState(320);

  const ws = useRef(null);
  const markers = useRef({});
  const locationInterval = useRef(null);
  const onTripStatusRef = useRef(onTripStatus);
  const sheetContentRef = useRef(null);

  useEffect(() => {
    onTripStatusRef.current = onTripStatus;
  }, [onTripStatus]);

  // 0. Find Nearest Stop (Client-side selection)
  const nearestStop = React.useMemo(() => {
    if (!myPos || !tripData?.stops?.length) return null;
    let minDistance = Infinity;
    let nearest = null;

    tripData.stops.forEach((stop) => {
      // Use simple distance to pick candidates for routing
      const dist = Math.sqrt(Math.pow(myPos.lat - stop.lat, 2) + Math.pow(myPos.lon - stop.lon, 2));
      if (dist < minDistance) {
        minDistance = dist;
        nearest = stop;
      }
    });
    return nearest;
  }, [myPos, tripData]);

  // Fetch Road Route
  useEffect(() => {
    if (!myPos || !nearestStop) return;
    
    let isSubscribed = true;
    getWalkingRoute(myPos, nearestStop).then(data => {
      if (isSubscribed) setRouteData(data);
    });
    return () => { isSubscribed = false; };
  }, [myPos, nearestStop]);

  // Notifications init
  useEffect(() => {
    notificationService.requestPermission();
  }, []);

  // 1. Initial REST Fetch
  useEffect(() => {
    const init = async () => {
      if (!tripId || tripId === "undefined") {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get(API_PATHS.operations.tripDetail(tripId));
        setTripIdData(res.data);
      } catch (err) {
        console.error("Trip init failed", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [tripId]);

  // 2. Initialize Map (Only after loading is false)
  useEffect(() => {
    if (loading || map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [78.9629, 20.5937],
      zoom: 12,
    });

    map.current.on("load", () => {
      if (!map.current.getSource("footprints")) {
        map.current.addSource("footprints", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.current.addLayer({
          id: "footprints-line",
          type: "line",
          source: "footprints",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#4f46e5",
            "line-width": 4,
            "line-dasharray": [0.3, 1.6],
            "line-opacity": 0.9,
          },
        });
      }
    });

    // Once map loads, try to find user location
    navigator.geolocation.getCurrentPosition((pos) => {
       setMyPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [loading]);

  // 3. Setup WebSocket
  useEffect(() => {
    if (loading || !tripId || tripId === "undefined") return;

    const token = localStorage.getItem("access_token");
    const wsUrl = getWsUrl(`/ws/tracking/trip/${tripId}/?token=${token}`);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setWsStatus("connected");
      // Start sending location updates every 10s
      if (locationInterval.current) clearInterval(locationInterval.current);
      locationInterval.current = setInterval(() => {
        if (myPos && ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: "location_update",
            lat: myPos.lat,
            lon: myPos.lon,
            trip_id: tripId
          }));
        }
      }, 10000);
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);

      // 0. Trip lifecycle events pushed by the backend
      if (data.status === "completed" || data.type === "trip_completed") {
        onTripStatusRef.current?.("completed");
        return;
      }
      if (data.status === "cancelled" || data.type === "trip_cancelled") {
        onTripStatusRef.current?.("cancelled");
        return;
      }

      // 1. Handle v_delta (New optimized format)
      if (data.type === "v_delta") {
        // Only update if it's our trip
        if (data.id === tripId) {
          setBusData({
            pos: [data.lat, data.lon],
            eta: data.eta || []
          });
        }
      } 
      // 2. Handle legacy/explicit updates
      else if (data.type === "city_vehicle_update" || data.type === "vehicle_update") {
        if (data.trip_id === tripId) {
          setBusData({
            pos: [data.lat, data.lon],
            eta: data.next_stop_eta || []
          });
        }
      } 
      // 3. Handle specific events
      else if (data.type === "eta_update" && data.data) {
        // Direct ETA update from passenger-to-vehicle calc
        setBusData(prev => ({
          ...prev,
          user_eta: data.data
        }));
      }
      else if (data.type === "vehicle_stopped" && data.trip_id === tripId) {
        setWsStatus("stopped");
      }
      else if (data.type === "proximity_alert") {
        notificationService.notify("Your ride is nearby", {
          body: data.message,
          tag: `proximity-${tripId}`,
          icon: "/vite.svg"
        });
      }
    };

    ws.current.onclose = () => {
      setWsStatus("disconnected");
      if (locationInterval.current) clearInterval(locationInterval.current);
    };

    return () => {
      ws.current?.close();
      if (locationInterval.current) clearInterval(locationInterval.current);
    };
  }, [loading, tripId, myPos]);

  // 4. Update Markers & Sync Bounds
  useEffect(() => {
    if (!map.current) return;

    const points = [];

    // Vehicle marker
    if (busData.pos) {
      const [lat, lon] = busData.pos;
      points.push([lon, lat]);

      if (!markers.current.bus) {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center bg-emerald-600 text-white w-10 h-10 rounded-full border-4 border-white shadow-xl";
        const isBike = (tripData?.vehicle_type || tripData?.vehicle?.vehicle_type) === "bike";
        el.innerHTML = isBike
          ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"></circle><circle cx="18" cy="17" r="3"></circle><path d="M9 17l3-8 4 8H9l-3-7h5"></path><path d="M12 9h3"></path></svg>`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16V9l2-4h14l2 4v7"></path><path d="M3 11h18M5 16h14M6 16v3m12-3v3"></path><circle cx="7" cy="15" r="1"></circle><circle cx="17" cy="15" r="1"></circle></svg>`;
        
        markers.current.bus = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map.current);
      } else {
        markers.current.bus.setLngLat([lon, lat]);
      }
    }

    // My Position Marker
    if (myPos) {
      points.push([myPos.lon, myPos.lat]);
      if (!markers.current.me) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#00E676";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
        
        markers.current.me = new maplibregl.Marker({ element: el })
          .setLngLat([myPos.lon, myPos.lat])
          .addTo(map.current);
      } else {
        markers.current.me.setLngLat([myPos.lon, myPos.lat]);
      }
    }

    // Nearest Stop Marker
    if (nearestStop) {
      points.push([nearestStop.lon, nearestStop.lat]);
      if (!markers.current.nearest) {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center bg-indigo-600 text-white w-6 h-6 rounded-full border-2 border-white shadow-lg";
        el.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
        
        markers.current.nearest = new maplibregl.Marker({ element: el })
          .setLngLat([nearestStop.lon, nearestStop.lat])
          .addTo(map.current);
      } else {
        markers.current.nearest.setLngLat([nearestStop.lon, nearestStop.lat]);
      }
    } else if (markers.current.nearest) {
      markers.current.nearest.remove();
      delete markers.current.nearest;
    }

    // Auto Zoom
    if (points.length > 0) {
      const bounds = points.reduce(
        (acc, coord) => acc.extend(coord), 
        new maplibregl.LngLatBounds(points[0], points[0])
      );
      map.current.fitBounds(bounds, { padding: 100, duration: 2000 });
    }

  }, [busData, myPos, nearestStop, tripData?.vehicle_type, tripData?.vehicle?.vehicle_type]);

  // 5. Update Footprints
  useEffect(() => {
    if (!map.current || !routeData) return;

    const updateLayer = () => {
      const source = map.current.getSource("footprints");
      if (source) {
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: routeData.geometry,
          },
        });
      }
    };

    if (map.current.isStyleLoaded()) {
      updateLayer();
    } else {
      map.current.on("load", updateLayer);
    }
  }, [routeData]);

  // 6. Keep the floating zoom controls docked above the bottom sheet
  useEffect(() => {
    const content = sheetContentRef.current;
    const sheet = content ? content.parentElement : null;
    if (!sheet || typeof ResizeObserver === "undefined") return undefined;

    const update = () => setSheetHeight(sheet.offsetHeight);
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    update();
    return () => observer.disconnect();
  }, [loading]);

  const etaText = busData.eta?.[0]
    ? Math.ceil(busData.eta[0].duration_seconds / 60)
    : "--";

  const handleShareTrip = () => {
    const message = `Track my trip on OMV! Trip ID: ${tripId || "N/A"}`;
    if (navigator.share) {
      navigator.share({ text: message }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(message).catch(() => {});
    }
  };

  const handleSOS = () => {
    window.alert(
      "SOS Emergency\n\nEmergency assistance has been notified. Stay calm, help is on the way.",
    );
  };

  const handleCallDriver = () => {
    const phone = tripData?.driver_phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      window.alert("Call Driver\n\nDriver contact number is not available yet.");
    }
  };

  const handleReportIssue = () => {
    window.alert("Report Issue\n\nPlease contact support at info@onmyvayy.com.");
  };

  const VehicleIcon = (tripData?.vehicle_type || tripData?.vehicle?.vehicle_type) === "bike" ? Bike : CarFront;

  if (loading) return (
    <div className={`${SHELL} flex flex-col items-center justify-center gap-4 bg-[#F8FAF9]`}>
      <LiveDot size={14} />
      <p className="text-sm font-bold text-[#6B7280]">Syncing live trip data...</p>
    </div>
  );

  if (!tripId || tripId === "undefined" || (!loading && !tripData)) return (
    <div className={`${SHELL} flex flex-col items-center justify-center gap-4 bg-[#F8FAF9] px-10 text-center`}>
      <span className="text-[44px] font-black leading-none text-[#EF4444]">!</span>
      <h3 className="text-[20px] font-black text-[#111827]">Trip Not Found</h3>
      <VayyButton variant="primary" size="md" onClick={onBack}>
        Go Back
      </VayyButton>
    </div>
  );

  return (
    <div className={`${SHELL} overflow-hidden`}>
      {/* Full-screen MapLibre map */}
      <div ref={mapContainer} className="absolute inset-0 bg-slate-200" />

      {/* Top floating chrome: back + connection pill + ETA card */}
      <div className="pointer-events-none absolute inset-0 z-overlay flex flex-col">
        <div className="flex items-center justify-between p-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-v-md bg-white shadow-v-sm transition hover:bg-gray-50 active:scale-95"
          >
            <ChevronLeft size={24} className="text-[#111827]" />
          </button>

          <div className="flex items-center gap-2 rounded-full bg-black px-3 py-2">
            <span
              className={`h-2 w-2 rounded-full ${
                wsStatus === "connected" ? "bg-[#00E676]" : "bg-[#EF4444]"
              }`}
            />
            <span className="text-[11px] font-black uppercase text-white">
              {wsStatus}
            </span>
          </div>
        </div>

        <div className="mx-auto rounded-v-md bg-white px-3 py-3 shadow-v-md">
          <p className="text-center text-[11px] font-bold text-[#6B7280]">
            Arriving in
          </p>
          <p className="text-center text-2xl font-black text-[#009849]">
            {etaText} min
          </p>
        </div>
      </div>

      {/* Zoom controls (mobile ZoomControls replica) */}
      <div
        className="absolute right-4 z-overlay flex flex-col gap-2.5"
        style={{ bottom: sheetHeight + 16 }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => map.current?.zoomIn()}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition hover:bg-gray-50 active:scale-95"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => map.current?.zoomOut()}
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition hover:bg-gray-50 active:scale-95"
        >
          <Minus size={22} strokeWidth={2.5} />
        </button>
      </div>

      {/* Bottom sheet */}
      <BottomSheet className="max-h-[78dvh] overflow-y-auto">
        <div ref={sheetContentRef} className="space-y-4">
          {/* Vehicle / route info + ETA */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
          <h2 className="flex items-center gap-2 truncate text-[22px] font-black leading-tight text-[#111827]">
                <VehicleIcon size={22} className="shrink-0 text-[#009849]" />
                {tripData?.vehicle_number || tripData?.vehicle?.vehicle_number || "Your ride"}
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-[#6B7280]">
                {tripData?.route_name || "Active Route"}
              </p>
            </div>
            <span className="shrink-0 text-[22px] font-black text-[#009849]">
              {etaText} min
            </span>
          </div>

          {/* Pickup and drop-off details */}
          <div className="flex flex-wrap gap-2">
            <MetricChip
              icon={Navigation}
              label="Pickup"
              value={tripData?.pickup_location_name || tripData?.pickup_stop?.name || tripData?.stops?.[0]?.name || "Pickup location"}
            />
            <MetricChip
              icon={Clock}
              label="Drop-off"
              value={tripData?.destination_name || tripData?.dropoff_stop?.name || tripData?.stops?.[tripData.stops.length - 1]?.name || "Destination"}
            />
          </div>

          {/* Ride progress */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-[#374151]">Pickup</span>
            <span className="h-[3px] flex-1 bg-[#009849]" />
            <span className="text-[11px] font-extrabold text-[#374151]">In Ride</span>
            <span className="h-[3px] flex-1 bg-[#E5E7EB]" />
            <span className="text-[11px] font-extrabold text-[#374151]">Drop-off</span>
          </div>

          {/* Stay alert banner (mobile) */}
          <div className="flex items-center gap-3 rounded-v-md bg-[#EFF6FF] p-3">
            <p className="flex-1 text-xs font-bold text-[#374151]">
              Stay alert! Your vehicle location updates live.
            </p>
            <button
              type="button"
              onClick={() => notificationService.requestPermission()}
              className="shrink-0 rounded-full bg-white px-3 py-2 text-[11px] font-black text-[#009849] transition hover:bg-[#E0F5E8] active:scale-95"
            >
              Turn On Alerts
            </button>
          </div>

          {/* Awaiting signal (web) */}
          {!busData.pos && (
            <div className="flex items-start gap-3 rounded-v-md border border-amber-100 bg-amber-50 p-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-amber-900">Awaiting Signal</p>
                <p className="text-xs text-amber-700">The vehicle's location is currently being resolved. Please stay tuned.</p>
              </div>
            </div>
          )}

          {/* Ride status (web) */}
          {rideStatus ? (
            <div className="flex items-start gap-3 rounded-v-md border border-emerald-100 bg-emerald-50 p-3">
              <Info size={18} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-bold text-emerald-900 capitalize">{rideStatus}</p>
                <p className="text-xs text-emerald-700">
                  Live status updates stream in over your trip channel.
                </p>
              </div>
            </div>
          ) : null}

          {/* Quick actions (mobile) */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Share Trip", onClick: handleShareTrip },
              { label: "SOS", onClick: handleSOS },
              { label: "Call Driver", onClick: handleCallDriver },
              { label: "Report Issue", onClick: handleReportIssue },
            ].map(({ label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="rounded-v-md bg-[#f9fafb] px-3 py-2 text-xs font-extrabold text-[#374151] transition hover:bg-[#F3F4F6] active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Primary action */}
          {showEndRide ? (
            <div>
              {endError ? (
                <p className="mb-3 rounded-v-md bg-red-50 p-3 text-xs font-bold text-red-600">
                  {endError}
                </p>
              ) : null}
              <VayyButton
                variant="primary"
                size="lg"
                fullWidth
                loading={ending}
                onClick={onEndRide}
              >
                {ending ? "Ending ride..." : "End Ride"}
              </VayyButton>
              <p className="mt-2 text-center text-xs font-semibold text-[#9CA3AF]">
                Your fuel share is settled the moment the ride ends.
              </p>
            </div>
          ) : (
            null
          )}
        </div>
      </BottomSheet>
    </div>
  );
};

export default PassengerLiveTracking;
