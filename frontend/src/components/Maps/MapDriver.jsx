/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronDown, 
  Compass, 
  Navigation, 
  Play, 
  Bus, 
  MapPin, 
  Users, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  TrendingUp,
  LogOut,
  StopCircle,
  Plus,
  Minus,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// --- Assets/Icons ---
import api, { getWsUrl } from "../../lib/api";
import DriverManifest from "../../components/DriverManifest";
import Header from "../../components/Layout/Header";

// Helper to decode OSRM polyline string
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

function getDistance(p1, p2) {
  const R = 6371e3;
  const phi1 = p1[0] * Math.PI/180;
  const phi2 = p2[0] * Math.PI/180;
  const dPhi = (p2[0]-p1[0]) * Math.PI/180;
  const dLambda = (p2[1]-p1[1]) * Math.PI/180;
  const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) +
          Math.cos(phi1) * Math.cos(phi2) *
          Math.sin(dLambda/2) * Math.sin(dLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// --- Components ---

const SidebarCard = ({ title, children, className = "" }) => (
  <div className={`p-4 ${className}`}>
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{title}</h3>
    {children}
  </div>
);

const StatItem = ({ icon: Icon, label, value, colorClass }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col gap-1 shadow-sm hover:border-slate-200 transition-colors">
    <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center mb-1`}>
      <Icon size={16} />
    </div>
    <span className="text-[10px] font-medium text-slate-500">{label}</span>
    <span className="text-xs font-bold text-slate-800">{value}</span>
  </div>
);

export default function MapDriver() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // --- User Logic States ---
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routePath, setRoutePath] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDriving, setIsDriving] = useState(false);
  const [passengers, setPassengers] = useState({});
  const [nextStops, setNextStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showManifest, setShowManifest] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Simulation Refs
  const ws = useRef(null);
  const simulationInterval = useRef(null);
  const pollIntervalRef = useRef(null);
  const vehicleMarker = useRef(null);
  const prevPos = useRef(null);

  // Dynamic values
  const activePassengerCount = useMemo(() => {
    return Object.values(passengers).filter(p => p.status === 'onboard').length;
  }, [passengers]);

  const distanceTravelled = useMemo(() => {
    if (!routePath || currentIndex === 0) return 0;
    let dist = 0;
    for (let i = 0; i < currentIndex; i++) {
      dist += getDistance(routePath[i], routePath[i+1]);
    }
    return dist;
  }, [routePath, currentIndex]);

  const totalTripDistance = tripData?.total_distance || 0;

  // Initialize Map
  useEffect(() => {
    if (map.current) return;
    
    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [77.3000, 28.5500],
      zoom: 13,
      pitch: 0,
      bearing: 0,
    });

    m.on("load", () => {
      setMapLoaded(true);
      m.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } }
      });

      m.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.4 }
      });
    });

    map.current = m;

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, []);

  // Sync Route Path and Stops
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
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

      // Clear existing markers
      document.querySelectorAll('.stop-marker').forEach(m => m.remove());

      // Render Stops if tripData has stops
      if (tripData?.stops) {
        tripData.stops.forEach((stop) => {
          const el = document.createElement("div");
          el.className = "stop-marker";
          el.style.backgroundColor = "#ef4444";
          el.style.borderRadius = "50%";
          el.style.width = "12px";
          el.style.height = "12px";
          el.style.border = "2px solid white";
          
          new maplibregl.Marker({ element: el })
            .setLngLat([stop.location.coordinates[0], stop.location.coordinates[1]])
            .setPopup(new maplibregl.Popup({ offset: 25 }).setText(stop.name))
            .addTo(map.current);
        });
      }

      if (routePath && routePath.length > 0 && !isDriving) {
        const bounds = routePath.reduce(
          (acc, coord) => acc.extend([coord[1], coord[0]]),
          new maplibregl.LngLatBounds([routePath[0][1], routePath[0][0]], [routePath[0][1], routePath[0][0]])
        );
        map.current.fitBounds(bounds, { padding: 50 });
      }
    }
  }, [routePath, tripData, isDriving, mapLoaded]);

  // Sync Vehicle Marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentPos) return;

    if (!vehicleMarker.current) {
      const el = document.createElement("div");
      el.className = "custom-bus-icon";
      el.innerHTML = `
        <div class="relative w-12 h-12 flex items-center justify-center">
          <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-150"></div>
          <div class="relative bg-emerald-600 w-8 h-12 rounded-lg border-2 border-white shadow-2xl flex flex-col items-center justify-center overflow-hidden">
            <div class="w-full h-2 bg-emerald-400 mb-1"></div>
            <div class="w-6 h-4 bg-white/20 rounded-sm"></div>
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

      const el = vehicleMarker.current.getElement();
      const inner = el.querySelector(".relative.bg-emerald-600");
      if (inner) inner.style.transform = `rotate(${bearing}deg)`;
    }
  }, [currentPos, isDriving, mapLoaded]);

  // Load Routes on Mount
  useEffect(() => {
    api.get("/api/driver/routes/")
      .then((res) => setAvailableRoutes(res.data))
      .catch((err) => console.error("Failed to load routes", err));
  }, []);

  // Poll Trip Status
  useEffect(() => {
    if (!isDriving || !tripData?.trip_id) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const pollTrip = async () => {
      try {
        const res = await api.get(`/api/driver/trip-status/${tripData.trip_id}/`);
        if (res.data.next_stops) {
          setNextStops(res.data.next_stops);
        }
        if (res.data.passengers) {
          setPassengers(res.data.passengers);
        }
      } catch (err) {
        console.error("Poll failed", err);
      }
    };

    pollIntervalRef.current = setInterval(pollTrip, 3000);
    pollTrip();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isDriving, tripData]);

  const handleLoadRoute = async () => {
    if (!selectedRouteId) return;
    setLoading(true);
    try {
      // Use the preview endpoint correctly
      const res = await api.post("/api/admin/routes/preview/", { route_id: selectedRouteId });
      
      // Use route_geometry or path from the preview response
      let path = typeof res.data.route_geometry === "string" 
        ? decodePolyline(res.data.route_geometry) 
        : res.data.route_geometry;
      
      setRoutePath(path);
      // Store preview data in tripData so stops are available for rendering
      setTripData({
        ...res.data,
        trip_id: null, // No active trip yet
        stops: res.data.stops || []
      });
      
      if (path && path.length > 0) {
        setCurrentPos(path[0]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error("Failed to load route preview", err);
    } finally {
      setLoading(false);
    }
  };

  const startDrive = async () => {
    if (!selectedRouteId || !routePath) return;
    try {
      // Actually start the trip now
      const res = await api.post("/api/driver/start-trip/", { route_id: selectedRouteId });
      setTripData(res.data);
      setIsDriving(true);
      setCurrentSpeed(35);
      
      let index = 0;
      simulationInterval.current = setInterval(() => {
        if (index >= routePath.length) {
          stopDrive();
          return;
        }
        setCurrentPos(routePath[index]);
        setCurrentIndex(index);
        setCurrentSpeed(prev => {
          const delta = Math.floor(Math.random() * 11) - 5;
          const next = prev + delta;
          return Math.max(10, Math.min(60, next));
        });
        index += 2;
      }, 1000);
    } catch (err) {
      console.error("Failed to start trip", err);
    }
  };

  const stopDrive = async () => {
    if (simulationInterval.current) clearInterval(simulationInterval.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (ws.current) ws.current.close();

    setIsDriving(false);
    setRoutePath(null);
    setTripData(null);
    setSelectedRouteId("");
    setCurrentSpeed(0);
    setCurrentIndex(0);
    if (vehicleMarker.current) {
      vehicleMarker.current.remove();
      vehicleMarker.current = null;
    }
    if (map.current && mapLoaded) {
      map.current.easeTo({ pitch: 0, bearing: 0, zoom: 13 });
    }
  };

  return (
    <div className="relative flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      <Header />
      
      {/* Background Map */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden absolute top-20 left-4 z-[20] w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center text-slate-600 border border-slate-100"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Content */}
      <aside className={`fixed lg:relative z-10 w-full sm:w-[380px] h-full pt-16 sm:pt-20 pb-6 lg:ml-6 flex flex-col pointer-events-none transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/95 backdrop-blur-md lg:rounded-3xl shadow-2xl shadow-slate-900/5 border border-white h-full flex flex-col pointer-events-auto overflow-hidden"
        >
          <div className="bg-slate-900 p-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Navigation size={24} className="transform rotate-45" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Driver Console</h2>
                <p className="text-xs font-medium text-slate-400">Manage your assigned route</p>
              </div>
            </div>
            {isDriving && (
              <div className="flex items-center gap-2">
                 <button
                  onClick={() => setShowManifest(!showManifest)}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase border transition-all ${showManifest ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  {showManifest ? "Hide Manifest" : "Show Manifest"}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
            {!isDriving && !routePath && (
              <SidebarCard title="Route Assignment">
                <div className="space-y-4">
                  <div className="relative bg-slate-50 border border-slate-100 rounded-2xl p-4 group">
                    <div className="flex items-center gap-3">
                      <Bus size={18} className="text-slate-400" />
                      <select 
                        className="flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
                        value={selectedRouteId}
                        onChange={(e) => setSelectedRouteId(e.target.value)}
                      >
                        <option value="">Select Assigned Route...</option>
                        {availableRoutes.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="text-slate-400" />
                    </div>
                  </div>
                  <button 
                    onClick={handleLoadRoute}
                    disabled={!selectedRouteId || loading}
                    className="w-full bg-emerald-500 hover:bg-brand-hover text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 disabled:bg-slate-300"
                  >
                    {loading ? <Clock className="animate-spin" size={18} /> : <Play size={18} fill="white" />}
                    <span className="text-sm">{loading ? 'Loading...' : 'Load Route'}</span>
                  </button>
                </div>
              </SidebarCard>
            )}

            {routePath && !isDriving && (
              <SidebarCard title="Ready to Start">
                <div className="space-y-4">
                   <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Total Distance</p>
                      <p className="text-xl font-black text-slate-800">
                        {(totalTripDistance / 1000).toFixed(1)} km
                      </p>
                    </div>
                    <MapPin className="text-emerald-300" size={24} />
                  </div>
                  <button 
                    onClick={startDrive}
                    className="w-full bg-emerald-500 hover:bg-brand-hover text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3"
                  >
                    <Play size={18} fill="white" />
                    <span className="text-sm">Start Trip</span>
                  </button>
                  <button onClick={stopDrive} className="w-full text-slate-400 text-xs hover:text-red-500 font-bold flex justify-center items-center gap-2 pointer-events-auto">
                    <LogOut size={14} /> Cancel
                  </button>
                </div>
              </SidebarCard>
            )}

            {isDriving && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <SidebarCard title="Next Stops">
                  <div className="space-y-2">
                    {nextStops.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        Polling live updates...
                      </div>
                    ) : (
                      nextStops.map((stop, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${idx === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idx === 0 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                              <MapPin size={14} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{stop.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">Arriving in {3 + idx} mins</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-slate-100 shadow-sm">
                            <Users size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-700">{stop.waiting_count || 0}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={stopDrive}
                    className="w-full mt-6 bg-red-50 hover:bg-red-100 text-red-500 py-4 rounded-xl font-bold transition-all border border-red-100 flex items-center justify-center gap-3"
                  >
                    <StopCircle size={18} />
                    <span className="text-sm">End Trip</span>
                  </button>
                </SidebarCard>
              </motion.div>
            )}

            <SidebarCard title="Vehicle Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-200 transition-colors">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Bus size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Number</p>
                    <p className="text-xs font-black text-slate-800 tracking-tight">{tripData?.vehicle_number || "UP16 AT 1234"}</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-200 transition-colors">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                   <Compass size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Type</p>
                    <p className="text-xs font-black text-slate-800">{tripData?.vehicle_type || "Electric"}</p>
                  </div>
                </div>
              </div>
            </SidebarCard>

            <SidebarCard title="Route Stats">
              <div className="grid grid-cols-2 gap-3">
                <StatItem icon={Clock} label="ETA" value={isDriving ? "22 mins" : "---"} colorClass="bg-slate-50 text-slate-500" />
                <StatItem icon={CheckCircle2} label="Status" value={isDriving ? "On Time" : "Ready"} colorClass="bg-emerald-50 text-emerald-500" />
              </div>
            </SidebarCard>
          </div>

          <div className="mt-auto p-4 px-6 mb-2 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-slate-100 transition-colors pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                  <HelpCircle size={16} />
                </div>
                <span className="text-xs font-bold text-slate-600">Assistance Required?</span>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </aside>

      {/* Floating Bottom Console */}
      <div className="absolute bottom-6 sm:bottom-10 left-1/2 transform -translate-x-1/2 z-10 w-[90%] sm:w-max pointer-events-auto">
        <AnimatePresence>
          {isDriving && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md px-6 sm:px-10 py-4 sm:py-5 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-white flex flex-row items-center justify-around sm:gap-12"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                  <Navigation size={16} className="sm:size-18 transform rotate-45" />
                </div>
                <div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Distance</p>
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums tracking-tighter">
                    {(distanceTravelled / 1000).toFixed(1)} / {(totalTripDistance / 1000).toFixed(1)} km
                  </p>
                </div>
              </div>
              <div className="w-px h-8 sm:h-10 bg-slate-100 mx-2" />
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                  <TrendingUp size={16} className="sm:size-18" />
                </div>
                <div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Current Speed</p>
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums tracking-tighter">{currentSpeed} km/h</p>
                </div>
              </div>
              <div className="w-px h-8 sm:h-10 bg-slate-100 mx-2" />
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                  <Users size={16} className="sm:size-18" />
                </div>
                <div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Passengers</p>
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums tracking-tighter">{activePassengerCount} Active</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map Control: Side */}
      <div className="absolute top-44 right-4 sm:right-6 z-10 flex flex-col gap-2 pointer-events-auto">
        <button className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
          <Plus size={20} />
        </button>
        <button className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
          <Minus size={20} />
        </button>
        <button className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors mt-2">
          <Compass size={20} />
        </button>
      </div>

      {/* Right Bottom Legend */}
      <div className="hidden sm:block absolute bottom-10 right-6 z-10 pointer-events-auto">
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-white space-y-4 w-52"
        >
          <div className="flex items-center gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
            <div className="w-6 h-1.5 bg-emerald-500 rounded-full shadow-sm" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Live Route</span>
          </div>
          <div className="flex items-center gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-md ring-4 ring-emerald-50" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Pickup Points</span>
          </div>
          <div className="flex items-center gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
            <div className="w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white shadow-md" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Upcoming Stops</span>
          </div>
        </motion.div>
      </div>

      {/* Right Side Manifest */}
      <AnimatePresence>
        {isDriving && showManifest && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 w-full sm:w-96 h-full z-[1001]"
          >
            <div className="relative h-full">
               <button 
                onClick={() => setShowManifest(false)}
                className="absolute top-20 -left-12 w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors pointer-events-auto"
              >
                <ChevronRight size={20} />
              </button>
              <DriverManifest
                vehicleId={tripData?.vehicle_id || "VAYY-123"}
                tripId={tripData?.trip_id}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
