// VAYY | src/components/Maps/MapDriver.jsx | Status: 🔧 Fixed
// Reason: Added Next 3 Stops panel, passenger waiting counts, and ETA polling.

import React, { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
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
  const mapContainer = useRef(null);
  const map = useRef(null);
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
  const vehicleMarker = useRef(null);
  const passengerMarkers = useRef({});
  const prevPos = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [76.7794, 30.7333], // Chandigarh [lon, lat]
      zoom: 13,
      pitch: 0,
      bearing: 0,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [],
          },
        },
      });

      map.current.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 8,
          "line-opacity": 0.3,
        },
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Sync Route Path
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const source = map.current.getSource("route");
    if (source) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: routePath ? routePath.map(p => [p[1], p[0]]) : [],
        },
      });

      if (routePath && routePath.length > 0 && !isDriving) {
        const bounds = routePath.reduce(
          (acc, coord) => acc.extend([coord[1], coord[0]]),
          new maplibregl.LngLatBounds([routePath[0][1], routePath[0][0]], [routePath[0][1], routePath[0][0]])
        );
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [routePath, isDriving]);

  // Sync Vehicle Marker and Camera
  useEffect(() => {
    if (!map.current || !currentPos) return;

    if (!vehicleMarker.current) {
      const el = document.createElement("div");
      el.className = "custom-bus-icon";
      el.innerHTML = `
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
      `;
      vehicleMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([currentPos[1], currentPos[0]])
        .addTo(map.current);
    } else {
      vehicleMarker.current.setLngLat([currentPos[1], currentPos[0]]);
    }

    if (isDriving) {
      let bearing = map.current.getBearing();
      if (prevPos.current) {
        const [lat1, lon1] = prevPos.current;
        const [lat2, lon2] = currentPos;
        // MapLibre bearing is degrees clockwise from North
        bearing = (Math.atan2(lon2 - lon1, lat2 - lat1) * 180) / Math.PI;
      }
      prevPos.current = currentPos;

      map.current.easeTo({
        center: [currentPos[1], currentPos[0]],
        zoom: 17,
        pitch: 60,
        bearing: bearing,
        duration: 1000,
      });

      // Update marker rotation
      const el = vehicleMarker.current.getElement();
      const inner = el.querySelector(".relative.bg-blue-600").parentElement;
      if (inner) inner.style.transform = `rotate(${bearing}deg)`;
    } else {
      map.current.setPitch(0);
      map.current.setBearing(0);
    }
  }, [currentPos, isDriving]);

  // Sync Passenger Markers
  useEffect(() => {
    if (!map.current) return;

    const currentPassengerIds = new Set();
    Object.entries(passengers).forEach(([id, p]) => {
      currentPassengerIds.add(id);
      if (!passengerMarkers.current[id]) {
        const el = document.createElement("div");
        el.className = "passenger-marker";
        el.style.width = p.hand_raised ? "16px" : "10px";
        el.style.height = p.hand_raised ? "16px" : "10px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = p.hand_raised ? "#f59e0b" : "#10b981";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 5px rgba(0,0,0,0.3)";

        if (p.hand_raised) {
          const hand = document.createElement("div");
          hand.innerHTML = "✋";
          hand.style.position = "absolute";
          hand.style.top = "-25px";
          hand.style.left = "-5px";
          hand.style.fontSize = "20px";
          hand.className = "animate-bounce";
          el.appendChild(hand);
        }

        passengerMarkers.current[id] = new maplibregl.Marker({ element: el })
          .setLngLat([p.lon, p.lat])
          .addTo(map.current);
      } else {
        passengerMarkers.current[id].setLngLat([p.lon, p.lat]);
        // Update style if hand raise status changed
        const el = passengerMarkers.current[id].getElement();
        el.style.backgroundColor = p.hand_raised ? "#f59e0b" : "#10b981";
        el.style.width = p.hand_raised ? "16px" : "10px";
        el.style.height = p.hand_raised ? "16px" : "10px";
      }
    });

    Object.keys(passengerMarkers.current).forEach(id => {
      if (!currentPassengerIds.has(id)) {
        passengerMarkers.current[id].remove();
        delete passengerMarkers.current[id];
      }
    });
  }, [passengers]);

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
    if (vehicleMarker.current) {
      vehicleMarker.current.remove();
      vehicleMarker.current = null;
    }
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

        <div ref={mapContainer} className="h-full w-full" />
      </div>
    </div>
  );
};






export default MapDriver;
