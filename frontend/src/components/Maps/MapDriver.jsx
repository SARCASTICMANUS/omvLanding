import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import api from "../../utils/api";
import {
  Play,
  Navigation,
  Bus,
  MapPin,
  StopCircle,
  Users,
  LogOut,
  Loader,
} from "lucide-react";
import Header from "../Layout/Header";
import "leaflet/dist/leaflet.css";

// --- Internal Helper: Fixes Tile Rendering Issues ---
const MapResizer = () => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    // Force a resize calculation after mount to ensure tiles load
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
};

// --- Internal Helper: Auto-fit Map Bounds ---
const MapUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

const MapDriver = () => {
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routePath, setRoutePath] = useState(null); // Array of [lat, lon]
  const [tripData, setTripData] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [isDriving, setIsDriving] = useState(false);
  const [passengerCount, setPassengerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const ws = useRef(null);
  const simulationRef = useRef(null);

  // 1. Fetch Routes on Load
  useEffect(() => {
    api
      .get("/api/driver/routes/")
      .then((res) => setAvailableRoutes(res.data))
      .catch((err) => console.error("Failed to load routes", err));
  }, []);

  // 2. Load Selected Route Logic
  const handleLoadRoute = async () => {
    if (!selectedRouteId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/driver/start-trip/", {
        route_id: selectedRouteId,
      });
      const path = res.data.route_geometry;
      setRoutePath(path);
      setTripData(res.data);
      if (path && path.length > 0) setCurrentPos(path[0]);
    } catch (err) {
      alert("Error loading route. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Start Driving
  const startDrive = () => {
    if (!tripData || !routePath) return;
    setIsDriving(true);

    const wsUrl = `ws://localhost:8000/ws/trip/${tripData.trip_id}/driver/`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log("WS Connected");

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "stats_update") setPassengerCount(data.passenger_count);
    };

    // Simulation Loop
    let index = 0;
    simulationRef.current = setInterval(() => {
      if (index >= routePath.length) {
        stopDrive();
        alert("Trip Complete");
        return;
      }
      const pos = routePath[index];
      setCurrentPos(pos);

      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ lat: pos[0], lon: pos[1] }));
      }
      index += 2; // Speed factor
    }, 1000);
  };

  const stopDrive = () => {
    if (simulationRef.current) clearInterval(simulationRef.current);
    if (ws.current) ws.current.close();
    setIsDriving(false);
    setRoutePath(null);
    setTripData(null);
    setPassengerCount(0);
    setSelectedRouteId("");
  };

  useEffect(() => {
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (ws.current) ws.current.close();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <Header />

      <div className="flex-1 w-full relative z-0">
        {/* --- Floating Control Panel --- */}
        <div className="absolute top-6 left-6 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-[1000] border border-white/20 overflow-hidden flex flex-col transition-all duration-300">
          {/* Header */}
          <div className="bg-slate-900 p-5 text-white flex items-center justify-between shadow-md">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Navigation size={20} className="text-emerald-400" /> Driver
                Console
              </h2>
            </div>
            {isDriving && (
              <div className="bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold text-red-100 uppercase border border-red-500/50 animate-pulse">
                Live
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col gap-5">
            {/* Step 1: Select Route */}
            {!isDriving && !routePath && (
              <div className="space-y-4">
                <div className="relative group">
                  <Bus
                    className="absolute left-3 top-3.5 text-slate-400"
                    size={20}
                  />
                  <select
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm transition-all"
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                  >
                    <option value="">Select Assigned Route...</option>
                    {availableRoutes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleLoadRoute}
                  disabled={!selectedRouteId || loading}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg flex justify-center items-center gap-2 disabled:bg-slate-300"
                >
                  {loading ? (
                    <Loader className="animate-spin" size={18} />
                  ) : (
                    "Load Route"
                  )}
                </button>
              </div>
            )}

            {/* Step 2: Confirm Start */}
            {routePath && !isDriving && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-blue-600 font-bold uppercase">
                      Total Distance
                    </p>
                    <p className="text-xl font-black text-slate-800">
                      {(tripData?.total_distance / 1000).toFixed(1)} km
                    </p>
                  </div>
                  <MapPin className="text-blue-300" size={24} />
                </div>
                <button
                  onClick={startDrive}
                  className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-600 transition shadow-lg flex items-center justify-center gap-2"
                >
                  <Play size={20} className="fill-current" /> Start Trip
                </button>
                <button
                  onClick={stopDrive}
                  className="w-full text-slate-400 text-xs hover:text-red-500 flex justify-center items-center gap-1"
                >
                  <LogOut size={14} /> Cancel
                </button>
              </div>
            )}

            {/* Step 3: Active Trip */}
            {isDriving && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <Users className="mx-auto text-slate-400 mb-2" size={24} />
                  <p className="text-4xl font-black text-slate-800">
                    {passengerCount}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Passengers Nearby
                  </p>
                </div>
                <button
                  onClick={stopDrive}
                  className="w-full bg-white border-2 border-red-100 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 transition flex justify-center items-center gap-2"
                >
                  <StopCircle size={20} /> End Trip
                </button>
              </div>
            )}
          </div>
        </div>

        {/* --- Map View --- */}
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapResizer />
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {routePath && (
            <Polyline
              positions={routePath}
              color="#2563eb"
              weight={8}
              opacity={0.6}
              lineCap="round"
            />
          )}

          {routePath && routePath.length > 0 && (
            <>
              <CircleMarker
                center={routePath[0]}
                radius={6}
                pathOptions={{
                  color: "#10b981",
                  fillColor: "white",
                  fillOpacity: 1,
                }}
              >
                <Popup>Start</Popup>
              </CircleMarker>
              <CircleMarker
                center={routePath[routePath.length - 1]}
                radius={6}
                pathOptions={{
                  color: "#ef4444",
                  fillColor: "white",
                  fillOpacity: 1,
                }}
              >
                <Popup>End</Popup>
              </CircleMarker>
            </>
          )}

          {currentPos && (
            <CircleMarker
              center={currentPos}
              radius={12}
              pathOptions={{
                color: "white",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 4,
              }}
            >
              <Popup>
                <span className="font-bold">You</span>
              </Popup>
            </CircleMarker>
          )}
          <MapUpdater bounds={routePath} />
        </MapContainer>
      </div>
    </div>
  );
};

export default MapDriver;
