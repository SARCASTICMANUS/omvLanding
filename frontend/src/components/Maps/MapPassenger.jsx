import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import api from "../../utils/api";
import {
  Loader,
  MapPin,
  Navigation,
  Clock,
  Search,
  X,
  AlertCircle,
} from "lucide-react";
import L from "leaflet";
import Header from "../Layout/Header";
import LocationSearch from "../Shared/LocationSearch";
import "leaflet/dist/leaflet.css";

// --- Internal Helper: Fixes Tile Rendering ---
const MapResizer = () => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
};

// --- Internal Helper: Auto Zoom ---
const AutoZoom = ({ vehiclePos, myPos }) => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    if (vehiclePos && myPos) {
      const bounds = L.latLngBounds([vehiclePos, [myPos.lat, myPos.lon]]);
      map.fitBounds(bounds, { padding: [80, 80] });
    }
  }, [vehiclePos, myPos, map]);
  return null;
};

// --- Internal Helper: Map Clicks ---
const LocationSelector = ({ onSelect }) => {
  useMapEvents({
    click(e) {
      onSelect({
        lat: e.latlng.lat,
        lon: e.latlng.lng,
        display_name: "Map Pin",
      });
    },
  });
  return null;
};

const MapPassenger = () => {
  const [myPos, setMyPos] = useState(null);
  const [matches, setMatches] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [vehiclePos, setVehiclePos] = useState(null);
  const [eta, setEta] = useState(null);
  const [loading, setLoading] = useState(false);

  const ws = useRef(null);
  const heartbeatRef = useRef(null);

  // 1. Search Logic
  const handleCheckForVehicles = async () => {
    if (!myPos) return;
    setLoading(true);
    setMatches([]);
    try {
      const res = await api.post("/api/passenger/match/", {
        lat: myPos.lat,
        lon: myPos.lon,
      });
      setMatches(res.data);
    } catch (err) {
      alert("Search failed.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Connection Logic
  const connectToTrip = (trip) => {
    setActiveTrip(trip);

    ws.current = new WebSocket(
      `ws://localhost:8000/ws/trip/${trip.trip_id}/passenger/`,
    );

    ws.current.onopen = () => {
      sendLocationUpdate();
      heartbeatRef.current = setInterval(sendLocationUpdate, 4000);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "vehicle_update") setVehiclePos([data.lat, data.lon]);
      if (data.type === "eta_update") setEta(data.data);
      if (data.type === "trip_ended") {
        alert("Driver ended trip");
        leaveTrip();
      }
    };
  };

  const sendLocationUpdate = () => {
    if (ws.current?.readyState === WebSocket.OPEN && myPos) {
      ws.current.send(JSON.stringify({ lat: myPos.lat, lon: myPos.lon }));
    }
  };

  const leaveTrip = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (ws.current) ws.current.close();
    setActiveTrip(null);
    setVehiclePos(null);
    setEta(null);
  };

  useEffect(() => {
    return () => leaveTrip();
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <Header />

      <div className="flex-1 w-full relative z-0">
        {/* --- Floating Panel --- */}
        <div className="absolute top-6 left-6 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-[1000] border border-white/20 flex flex-col max-h-[calc(100vh-120px)] transition-all">
          {/* Header */}
          <div className="bg-slate-900 p-5 rounded-t-2xl text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <MapPin size={20} className="text-emerald-400" />
              <div>
                <h2 className="font-bold text-sm">Find Your Ride</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  Passenger Mode
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-y-auto">
            {!activeTrip ? (
              <div className="space-y-6">
                {/* Step 1: Location */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    1. Set Location
                  </label>
                  <LocationSearch
                    placeholder="Search pickup point..."
                    onSelect={setMyPos}
                  />

                  {myPos ? (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="truncate">
                        {myPos.display_name.split(",")[0]}
                      </span>
                      <button
                        onClick={() => setMyPos(null)}
                        className="ml-auto text-blue-400 hover:text-blue-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic pl-1">
                      Or click on the map to pin.
                    </p>
                  )}
                </div>

                {/* Step 2: Scan */}
                <button
                  onClick={handleCheckForVehicles}
                  disabled={!myPos || loading}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition shadow-lg"
                >
                  {loading ? (
                    <Loader className="animate-spin" size={18} />
                  ) : (
                    <>
                      <Search size={18} /> Scan Nearby (10m)
                    </>
                  )}
                </button>

                {/* Step 3: Results */}
                {matches.length > 0 && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h3 className="text-xs font-bold text-slate-400 uppercase">
                        Available Vehicles
                      </h3>
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {matches.length} found
                      </span>
                    </div>
                    {matches.map((trip) => (
                      <button
                        key={trip.trip_id}
                        onClick={() => connectToTrip(trip)}
                        className="w-full text-left p-4 border border-slate-100 rounded-xl hover:border-blue-500 hover:shadow-md hover:bg-blue-50/50 transition group bg-white"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <Navigation
                              size={16}
                              className="text-blue-500 group-hover:scale-110 transition"
                            />{" "}
                            {trip.vehicle_type}
                          </div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                          <span className="font-medium">{trip.start}</span>
                          <span className="text-slate-300 mx-1">→</span>
                          <span className="font-medium">{trip.end}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {matches.length === 0 && !loading && myPos && (
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-center">
                    <AlertCircle
                      className="mx-auto text-orange-400 mb-2"
                      size={24}
                    />
                    <p className="text-sm font-bold text-orange-800">
                      No vehicles nearby.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Navigation size={64} />
                  </div>
                  <h3 className="font-bold text-lg mb-1">Vehicle En Route</h3>
                  <div className="text-emerald-100 text-xs">
                    {activeTrip.start} → {activeTrip.end}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    <Clock className="mx-auto mb-2 text-blue-400" size={20} />
                    <div className="text-2xl font-black text-slate-800">
                      {eta ? Math.ceil(eta.duration / 60) : "--"}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      Mins
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                    <Navigation
                      className="mx-auto mb-2 text-blue-400"
                      size={20}
                    />
                    <div className="text-2xl font-black text-slate-800">
                      {eta ? (eta.distance / 1000).toFixed(1) : "--"}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">
                      Km
                    </div>
                  </div>
                </div>

                <button
                  onClick={leaveTrip}
                  className="w-full border-2 border-red-100 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 hover:border-red-200 transition"
                >
                  Stop Tracking
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
            attribution=""
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {!activeTrip && <LocationSelector onSelect={setMyPos} />}
          <AutoZoom vehiclePos={vehiclePos} myPos={myPos} />

          {myPos && (
            <CircleMarker
              center={[myPos.lat, myPos.lon]}
              radius={8}
              pathOptions={{
                color: "white",
                fillColor: "#2563eb",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>You</Popup>
            </CircleMarker>
          )}

          {vehiclePos && (
            <CircleMarker
              center={vehiclePos}
              radius={12}
              pathOptions={{
                color: "white",
                fillColor: "#ef4444",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-center">
                  <strong>{activeTrip?.vehicle_type}</strong>
                  <br />
                  {eta
                    ? `${(eta.distance / 1000).toFixed(1)} km away`
                    : "Updating..."}
                </div>
              </Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapPassenger;
