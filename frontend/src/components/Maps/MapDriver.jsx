// VAYY | src/components/Maps/MapDriver.jsx | Status: 🔧 Fixed
// Reason: Added Next 3 Stops panel, passenger waiting counts, and ETA polling.

import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
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
  Hand
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

// Fit bounds or follow vehicle with tilt/auto-zoom
const DynamicAutoZoom = ({ currentPos, isDriving, routePath }) => {
  const map = useMap();
  const prevPos = useRef(null);

  useEffect(() => {
    if (!currentPos) return;

    if (isDriving) {
      // 1. Calculate heading for map rotation (so bus always faces "up")
      let heading = 0;
      if (prevPos.current) {
        const [lat1, lon1] = prevPos.current;
        const [lat2, lon2] = currentPos;
        // Invert angle for map rotation
        heading = (Math.atan2(lon1 - lon2, lat2 - lat1) * 180) / Math.PI;
      }
      prevPos.current = currentPos;

      // 2. Adjust zoom to 17 (from 18) for a broader view of the road
      map.setView(currentPos, 17, {
        animate: true,
        duration: 0.8,
      });

      // 3. Update CSS variables for 3D tilt/rotation
      const mapContainer = map.getContainer();
      mapContainer.style.setProperty('--map-rotation', `${heading}deg`);
      
      if (!mapContainer.classList.contains("navigation-mode")) {
        mapContainer.classList.add("navigation-mode");
      }
    } else if (routePath && routePath.length > 0) {
      const bounds = L.latLngBounds(routePath);
      map.fitBounds(bounds, { padding: [50, 50] });
      const mapContainer = map.getContainer();
      mapContainer.classList.remove("navigation-mode");
      mapContainer.style.removeProperty('--map-rotation');
    }
  }, [currentPos, isDriving, routePath, map]);

  return null;
};

// 3D-like Rotating Vehicle Marker
const VehicleMarker = ({ pos, isDriving }) => {
  const prevPos = useRef(null);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (prevPos.current && pos) {
      const [lat1, lon1] = prevPos.current;
      const [lat2, lon2] = pos;
      const angle = (Math.atan2(lon2 - lon1, lat2 - lat1) * 180) / Math.PI;
      if (Math.abs(lat2-lat1) > 0.00001 || Math.abs(lon2-lon1) > 0.00001) {
          setRotation(angle);
      }
    }
    prevPos.current = pos;
  }, [pos]);

  if (!pos) return null;

  const busIcon = L.divIcon({
    className: "custom-bus-icon",
    html: `
      <div style="transform: rotate(${rotation}deg); transition: transform 0.3s ease-out;">
        <div class="relative w-12 h-12 flex items-center justify-center">
          <div class="absolute inset-0 bg-blue-500/20 rounded-full animate-ping scale-150"></div>
          <div class="relative bg-blue-600 w-8 h-12 rounded-lg border-2 border-white shadow-2xl flex flex-col items-center justify-center overflow-hidden">
            <div class="w-full h-2 bg-blue-400 mb-1 flex justify-around px-1">
                <div class="w-1.5 h-1.5 bg-yellow-300 rounded-full"></div>
                <div class="w-1.5 h-1.5 bg-yellow-300 rounded-full"></div>
            </div>
            <div class="w-6 h-4 bg-white/20 rounded-sm"></div>
            <div class="mt-2 text-[8px] font-black text-white leading-none">VAYY</div>
          </div>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

  return (
    <Marker position={pos} icon={busIcon}>
      <Popup>Vehicle Live</Popup>
    </Marker>
  );
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
  const [passengers, setPassengers] = useState({}); 
  const [nextStops, setNextStops] = useState([]); 
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
      alert("Error loading route.");
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
    const wsUrl = `ws://${window.location.host.split(':')[0]}:8000/ws/public/${tripData.city_id || 'public'}/driver/${tripData.trip_id}/?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      pollNextStops(tripData.trip_id);
      pollIntervalRef.current = setInterval(() => pollNextStops(tripData.trip_id), 10000);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "student_update" || data.type === "passenger_update") {
        pollNextStops(tripData.trip_id);
        if (data.user_id && data.lat && data.lon) {
           setPassengers(prev => ({
              ...prev,
              [data.user_id]: {
                 lat: data.lat,
                 lon: data.lon,
                 hand_raised: !!data.hand_raised,
                 last_seen: Date.now()
              }
           }));
        }
      } else if (data.type === "passenger_stopped") {
         setPassengers(prev => {
            const next = { ...prev };
            delete next[data.user_id];
            return next;
         });
      }
    };

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
      index += 5; 
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
    const interval = setInterval(() => {
      const now = Date.now();
      setPassengers(prev => {
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([id, p]) => {
          if (now - p.last_seen > 300000) { 
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (ws.current) ws.current.close();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <style>{`
        .navigation-mode {
          perspective: 1000px;
          background: #1e293b;
        }
        .navigation-mode .leaflet-map-pane {
          transform: rotateX(55deg) rotateZ(var(--map-rotation, 0deg)) translateY(20%);
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Counter-rotate markers to keep them upright */
        .navigation-mode .custom-bus-icon, 
        .navigation-mode .leaflet-marker-icon,
        .navigation-mode .leaflet-popup {
          transform: rotateZ(calc(-1 * var(--map-rotation, 0deg))) rotateX(-55deg) translateY(-20px) !important;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
      <Header />

      <div className="flex-1 w-full relative z-0">
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

        <MapContainer
          center={[30.7333, 76.7794]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <MapResizer />
          <TileLayer
            attribution='&copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {routePath && (
             <Polyline positions={routePath} color="#2563eb" weight={8} opacity={0.3} lineCap="round" />
          )}

          {currentPos && (
            <VehicleMarker pos={currentPos} isDriving={isDriving} />
          )}

          {Object.entries(passengers).map(([id, p]) => (
            <React.Fragment key={id}>
              <CircleMarker
                center={[p.lat, p.lon]}
                radius={p.hand_raised ? 8 : 5}
                pathOptions={{
                  color: "white",
                  fillColor: p.hand_raised ? "#f59e0b" : "#10b981",
                  fillOpacity: 1,
                  weight: 2,
                }}
              />
              {p.hand_raised && (
                <Marker
                  position={[p.lat, p.lon]}
                  icon={L.divIcon({
                    html: `<div class="animate-bounce text-2xl" style="margin-top: -20px; margin-left: -10px;">✋</div>`,
                    className: 'hand-marker'
                  })}
                />
              )}
            </React.Fragment>
          ))}

          <DynamicAutoZoom 
            currentPos={currentPos} 
            isDriving={isDriving} 
            routePath={routePath} 
          />
        </MapContainer>
      </div>
    </div>
  );
};

export default MapDriver;
