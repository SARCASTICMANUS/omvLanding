// VAYY | src/components/Maps/MapDriver.jsx | Status: 🔧 Fixed
// Reason: Added Next 3 Stops panel, passenger waiting counts, and ETA polling.

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
  Clock,
  RefreshCw,
} from "lucide-react";
import Header from "../Layout/Header";
import "leaflet/dist/leaflet.css";

const MapResizer = () => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
};

const MapUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { 
        padding: [50, 50],
        animate: true,
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [bounds, map]);
  return null;
};

// Helper to decode OSRM polyline string to [lat, lon] array
function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change = 0, longitude_change = 0, factor = Math.pow(10, precision);
  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change; lng += longitude_change;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

const MapDriver = () => {
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routePath, setRoutePath] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [isDriving, setIsDriving] = useState(false);
  
  // Next 3 Stops tracking
  const [nextStops, setNextStops] = useState([]); // [{id, name, waiting_count, eta_seconds}]
  
  const [loading, setLoading] = useState(false);

  const ws = useRef(null);
  const simulationRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    api
      .get("/api/driver/routes/")
      .then((res) => setAvailableRoutes(res.data))
      .catch((err) => console.error("Failed to load routes", err));
  }, []);

  const handleLoadRoute = async () => {
    if (!selectedRouteId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/driver/start-trip/", {
        route_id: selectedRouteId,
      });
      // The old mock code assumed res.data.route_geometry was [lat,lon]. 
      // OSRM returns encoded geometry string.
      let path = [];
      if (typeof res.data.route_geometry === "string") {
         path = decodePolyline(res.data.route_geometry);
      } else {
         path = res.data.route_geometry;
      }
      setRoutePath(path);
      setTripData(res.data);
      if (path && path.length > 0) setCurrentPos(path[0]);
    } catch (err) {
      alert("Error loading route. Driver has active trip already?");
    } finally {
      setLoading(false);
    }
  };

  const pollNextStops = async (tripId) => {
    try {
      const res = await api.get(`/api/trips/next-stops/${tripId}/`);
      setNextStops(res.data);
    } catch (e) {
      console.error("Failed fetching next stops");
    }
  };

  const startDrive = () => {
    if (!tripData || !routePath) return;
    setIsDriving(true);

    const token = localStorage.getItem("token");
    const wsUrl = `ws://${window.location.host.split(':')[0]}:8000/ws/trip/${tripData.trip_id}/driver/?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("WS Connected");
      pollNextStops(tripData.trip_id);
      pollIntervalRef.current = setInterval(() => pollNextStops(tripData.trip_id), 10000);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "student_update") {
        // A student just moved or activated. Refresh counts for realism.
        pollNextStops(tripData.trip_id);
      }
    };

    // Simulation Loop (Simulating GPS updates)
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
      index += 5; // Simulating movement speed
    }, 1000);
  };

  const stopDrive = async () => {
    if (simulationRef.current) clearInterval(simulationRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (ws.current) ws.current.close();
    
    if (tripData?.trip_id) {
       try {
           await api.post(`/api/trips/end/${tripData.trip_id}/`);
       } catch (e) {
           console.error(e);
       }
    }

    setIsDriving(false);
    setRoutePath(null);
    setTripData(null);
    setNextStops([]);
    setSelectedRouteId("");
  };

  useEffect(() => {
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (ws.current) ws.current.close();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <Header />

      <div className="flex-1 w-full relative z-0">
        {/* --- Floating Control Panel --- */}
        <div className="absolute top-6 left-6 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-[1000] border border-white/20 overflow-hidden flex flex-col max-h-[calc(100vh-120px)] transition-all duration-300">
          <div className="bg-slate-900 p-5 text-white flex items-center justify-between shadow-md">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Navigation size={20} className="text-emerald-400" /> Driver Console
              </h2>
            </div>
            {isDriving && (
              <div className="bg-red-500/20 px-2 py-1 rounded text-[10px] font-bold text-red-100 uppercase border border-red-500/50 animate-pulse">
                Live
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col gap-5 overflow-y-auto">
            {/* Step 1: Select Route */}
            {!isDriving && !routePath && (
              <div className="space-y-4">
                <div className="relative group">
                  <Bus className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <select
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm transition-all"
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                  >
                    <option value="">Select Assigned Route...</option>
                    {availableRoutes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} {r.bus_number ? `(Bus ${r.bus_number})` : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleLoadRoute}
                  disabled={!selectedRouteId || loading}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg flex justify-center items-center gap-2 disabled:bg-slate-300"
                >
                  {loading ? <Loader className="animate-spin" size={18} /> : "Load Route"}
                </button>
              </div>
            )}

            {/* Step 2: Confirm Start */}
            {routePath && !isDriving && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-blue-600 font-bold uppercase">Total Distance</p>
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

            {/* Step 3: Active Trip (Next Stops) */}
            {isDriving && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-end pb-2 border-b border-slate-200">
                   <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                      <StopCircle size={14} className="text-slate-400"/> Next Stops
                   </h3>
                   <span className="text-[10px] text-slate-400 flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> Live Polling</span>
                </div>

                {nextStops.length === 0 ? (
                  <div className="text-sm text-slate-500 text-center py-4">Locating next stops...</div>
                ) : (
                  <div className="space-y-3">
                     {nextStops.map((stop, idx) => (
                        <div key={stop.id} className={`p-4 rounded-xl border ${idx === 0 ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-100'}`}>
                           <div className="flex justify-between items-start mb-2">
                              <span className="font-bold text-slate-800">{stop.name}</span>
                              <div className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                                 <Users size={12}/> {stop.waiting_count}
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
                )}

                <button
                  onClick={stopDrive}
                  className="w-full mt-4 bg-white border-2 border-red-100 text-red-500 py-3 rounded-xl font-bold hover:bg-red-50 transition flex justify-center items-center gap-2"
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            className="map-grayscale"
          />

          {routePath && (
             <Polyline positions={routePath} color="#2563eb" weight={6} opacity={0.6} lineCap="round" />
          )}

          {currentPos && (
            <CircleMarker
              center={currentPos}
              radius={10}
              pathOptions={{
                color: "white", fillColor: "#ef4444", fillOpacity: 1, weight: 3,
              }}
            >
              <Popup>
                <div className="font-bold text-center">Bus {tripData?.bus_number}</div>
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
