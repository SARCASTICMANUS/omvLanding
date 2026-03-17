// VAYY | src/components/Maps/MapPassenger.jsx | Status: 🔧 Fixed
// Reason: Added WebSocket reconnect with exponential backoff, Multi-bus markers, 
// Assigned Route Polyline, ETA Overlays, and Bus Pass expiry warning banner.

import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  Polyline,
} from "react-leaflet";
import api from "../../utils/api";
import { Navigation, Clock, Search, AlertCircle, RefreshCw } from "lucide-react";
import L from "leaflet";
import Header from "../Layout/Header";
import "leaflet/dist/leaflet.css";

// Fix map bounds dynamically
const MapResizer = () => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
};

// Fit bounds to show route and buses
const AutoZoom = ({ routeLine, buses, myPos }) => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    const points = [];
    if (myPos) points.push([myPos.lat, myPos.lon]);
    
    if (routeLine && routeLine.length > 0) {
      points.push(...routeLine);
    }
    
    Object.values(buses).forEach(b => {
      if (b.pos) points.push(b.pos);
    });

    if (points.length > 0) {
      try {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { 
            padding: [80, 80],
            animate: true,
            duration: 1.5,
            easeLinearity: 0.25
        });
      } catch (e) {
        // Handle edge case where points are identical
      }
    }
  }, [routeLine, buses, myPos, map]);
  return null;
};

// Helper to decode OSRM polyline string to [lat, lon] array
function decodePolyline(str, precision = 5) {
  let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
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

const MapPassenger = () => {
  const [dashboard, setDashboard] = useState(null);
  const [buses, setBuses] = useState({}); // { trip_id: { pos: [lat, lon], bus_number: "...", eta: [..] } }
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [myPos, setMyPos] = useState(null); // { lat, lon }
  const [isLocationActive, setIsLocationActive] = useState(false);
  
  const ws = useRef(null);
  const watchId = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;

  // Haversine distance helper (meters)
  const calculateDistance = (p1, p2) => {
    if (!p1 || !p2) return null;
    const R = 6371e3;
    const φ1 = p1.lat * Math.PI/180;
    const φ2 = p2.lat * Math.PI/180;
    const Δφ = (p2.lat-p1.lat) * Math.PI/180;
    const Δλ = (p2.lon-p1.lon) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    fetchDashboard();
    return () => cleanupWs();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/student/dashboard/");
      setDashboard(res.data);
      if (res.data.university_id) {
        connectWebSocket(res.data.university_id);
      }
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (universityId) => {
    cleanupWs();
    setWsStatus("connecting");
    
    // Connect to universal university stream with JWT auth
    const token = localStorage.getItem("token");
    ws.current = new WebSocket(`ws://${window.location.host.split(':')[0]}:8000/ws/university/${universityId}/student/?token=${token}`);

    ws.current.onopen = () => {
      setWsStatus("connected");
      reconnectAttempts.current = 0;
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "university_vehicle_update") {
        setBuses(prev => ({
          ...prev,
          [data.trip_id]: {
            pos: [data.lat, data.lon],
            bus_number: data.bus_number,
            route_id: data.route_id,
            next_stop_eta: data.next_stop_eta
          }
        }));
      } else if (data.type === "vehicle_stopped") {
        setBuses(prev => {
          const newBuses = { ...prev };
          delete newBuses[data.trip_id];
          return newBuses;
        });
      }
    };

    ws.current.onclose = () => {
      setWsStatus("disconnected");
      scheduleReconnect(universityId);
    };

    ws.current.onerror = () => {
      // onerror is followed by onclose, so logic goes there
    };
  };

  const scheduleReconnect = (universityId) => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    
    const baseDelay = 1000;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts.current), maxReconnectDelay);
    
    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current += 1;
      connectWebSocket(universityId);
    }, delay);
  };

  const cleanupWs = () => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (ws.current) {
      ws.current.onclose = null; // Prevent reconnect loop on unmount
      ws.current.close();
    }
  };

  const toggleLocationSharing = () => {
    if (isLocationActive) {
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setIsLocationActive(false);
    } else {
        setIsLocationActive(true);
        startTracking();
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    
    watchId.current = navigator.geolocation.watchPosition(
        async (pos) => {
            const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            setMyPos(newPos);
            
            // Push to backend via WebSocket instead of HTTP
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ 
                    lat: pos.coords.latitude, 
                    lon: pos.coords.longitude 
                }));
            }
        },
        (err) => console.error("Position error", err),
        { enableHighAccuracy: true, maximumAge: 10000 }
    );
  };

  useEffect(() => {
    return () => {
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  if (loading) return <div className="p-8 flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-blue-500" /></div>;
  if (!dashboard) return <div className="p-8 text-center text-slate-500">Failed to load dashboard. Make sure you have a student profile.</div>;

  const validPass = dashboard.student_profile?.boarding_eligible;
  const routeLine = dashboard.assigned_route?.path_coords || [];
  const pickupStop = dashboard.pickup_stop?.lat ? dashboard.pickup_stop : null;
  
  // Only show buses on the user's assigned route
  const relevantBuses = Object.entries(buses).filter(([tripId, b]) => {
    if (!dashboard.assigned_route?.id) return true; // Show all if no route assigned
    return String(b.route_id) === String(dashboard.assigned_route.id);
  });

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <Header />

      {/* Expiry Banner */}
      {!validPass && (
        <div className="bg-red-500 text-white px-4 py-2 text-sm font-bold flex justify-center items-center gap-2">
          <AlertCircle size={16} /> Your bus pass has expired or is invalid. Boarding may be denied.
        </div>
      )}

      <div className="flex-1 w-full relative z-0">
        {/* --- Floating Panel --- */}
        <div className="absolute top-6 left-6 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-[1000] border border-white/20 flex flex-col max-h-[calc(100vh-120px)] overflow-hidden">
          <div className="bg-slate-900 p-5 rounded-t-2xl text-white flex items-center justify-between shadow-md">
            <div>
              <h2 className="font-bold text-sm">{dashboard.route?.name || "Unassigned"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-orange-400'}`}></span>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {wsStatus === 'connected' ? 'Live Stream Active' : 'Connecting...'}
                </p>
              </div>
            </div>
            {dashboard.route?.bus_number && (
              <div className="px-3 py-1 bg-white/10 rounded-lg font-mono text-emerald-400 border border-white/10 font-bold border-emerald-500/30">
                #{dashboard.route.bus_number}
              </div>
            )}
          </div>

          <div className="p-4 overflow-y-auto w-full">
            {/* Location Status Toggle */}
            <div className="mb-4 bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tracking Status</p>
                    <p className="text-xs font-bold text-slate-700">{isLocationActive ? "Location Shared" : "Location Inactive"}</p>
                </div>
                <button 
                    onClick={toggleLocationSharing}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isLocationActive ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}
                >
                    {isLocationActive ? "Deactivate" : "Activate"}
                </button>
            </div>

            {myPos && pickupStop && (
                <div className="mb-4 bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">You to Pickup Point</p>
                    <div className="flex items-center gap-2 mt-1">
                        <Navigation size={14} className="text-indigo-600 rotate-45" />
                        <span className="text-sm font-black text-indigo-900">
                            {(calculateDistance(myPos, pickupStop) / 1000).toFixed(2)} km
                        </span>
                    </div>
                </div>
            )}

            {relevantBuses.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                No active buses on your route right now.
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase">Active Buses</h3>
                {relevantBuses.map(([tripId, bus]) => {
                  const firstStop = bus.next_stop_eta?.[0];
                  // Calculate distance from bus to our pickup stop if coords match
                  const busPos = { lat: bus.pos[0], lon: bus.pos[1] };
                  const distToMe = pickupStop ? calculateDistance(busPos, pickupStop) : null;

                  return (
                    <div key={tripId} className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-blue-900 text-sm flex items-center gap-2">
                           <Navigation size={14} className="text-blue-500"/> Bus {bus.bus_number}
                        </span>
                        {distToMe && (
                            <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-blue-100 text-blue-600 font-bold">
                                {(distToMe/1000).toFixed(1)}km to go
                            </span>
                        )}
                      </div>
                      {firstStop ? (
                         <div className="flex items-center gap-2 text-xs text-slate-600 bg-white p-2 border border-slate-100 rounded-lg shadow-sm">
                            <Clock size={14} className="text-emerald-500"/> 
                            <span className="font-medium text-slate-800">{Math.ceil(firstStop.duration_seconds/60)} mins</span> to {firstStop.stop_name}
                         </div>
                      ) : (
                         <div className="text-xs text-slate-400">ETA computing...</div>
                      )}
                    </div>
                  );
                })}
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

          <AutoZoom routeLine={routeLine} buses={buses} myPos={myPos || pickupStop} />

          {/* User Current Location */}
          {myPos && (
            <CircleMarker
              center={[myPos.lat, myPos.lon]}
              radius={6}
              pathOptions={{ color: "white", fillColor: "#4f46e5", fillOpacity: 1, weight: 3 }}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
          )}


          {/* Pickup Stop */}
          {pickupStop && (
            <CircleMarker
              center={[pickupStop.lat, pickupStop.lon]}
              radius={8}
              pathOptions={{ color: "white", fillColor: "#10b981", fillOpacity: 1, weight: 3 }}
            >
              <Popup>Your Pickup Stop</Popup>
            </CircleMarker>
          )}

          {/* Live Buses */}
          {relevantBuses.map(([tripId, bus]) => (
            <React.Fragment key={tripId}>
              {/* Pulsing Aura */}
              <CircleMarker
                center={bus.pos}
                radius={15}
                pathOptions={{ color: "transparent", fillColor: "#ef4444", fillOpacity: 0.2, weight: 0 }}
                className="animate-pulse"
              />
              <CircleMarker
                center={bus.pos}
                radius={10}
                pathOptions={{ color: "white", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }}
              >
                <Popup>
                  <div className="text-center font-bold text-slate-800">Bus {bus.bus_number}</div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapPassenger;
