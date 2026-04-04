// VAYY | src/components/Maps/MapPassenger.jsx | Status: ✅ Public Transport Refactor
// Passenger can see ALL active public buses — no assignment needed.

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
import { Navigation, Clock, Bus, RefreshCw, MapPin, Hand, Search, ArrowRight } from "lucide-react";
import L from "leaflet";
import Header from "../Layout/Header";
import LocationSearch from "../LocationSearch";
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
const AutoZoom = ({ routeLine, buses, myPos, pickup, destination }) => {
  const map = useMap({ attributionControl: false });
  useEffect(() => {
    const points = [];
    if (myPos) points.push([myPos.lat, myPos.lon]);
    if (pickup) points.push([pickup.lat, pickup.lon]);
    if (destination) points.push([destination.lat, destination.lon]);
    
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
  }, [routeLine, buses, myPos, map, pickup, destination]);
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
  const [locationError, setLocationError] = useState(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [stopDistances, setStopDistances] = useState({}); // { route_id: distance_string }
  
  // New state for filtered trips
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);

  const ws = useRef(null);
  const watchId = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;

  useEffect(() => {
    fetchDashboard();
    return () => cleanupWs();
  }, []);

  // Synchronize WebSocket with selectedTripId
  useEffect(() => {
    if (selectedTripId) {
      connectWebSocket(null, selectedTripId);
    } else {
      cleanupWs();
      setWsStatus("disconnected");
      setBuses({}); // Reset positions when no bus is selected
    }
  }, [selectedTripId]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      // Use the public passenger dashboard — returns nearby active trips, no assignment required
      const res = await api.get("/api/passenger/dashboard/");
      setDashboard(res.data);
      // Populate initial buses from REST so map is populated even before WS connects
      const initialBuses = {};
      (res.data.active_trips || []).forEach((trip) => {
        initialBuses[trip.trip_id] = {
          pos: null, // position comes from WS
          bus_number: trip.bus_number,
          route_name: trip.route_name,
          route_id: trip.trip_id,
          next_stop_eta: [],
          stops: trip.stops, // Include stops for distance calculation
        };
      });
      setBuses(initialBuses);
    } catch (err) {
      console.error("Failed to load dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = (cityId, tripId = null) => {
    cleanupWs();
    setWsStatus("connecting");

    const token = localStorage.getItem("token");
    // Use the new public WS URL; if no cityId, connect to global 'public' group
    const groupId = cityId || "public";

    // Add tripId to the WebSocket URL if selected
    const wsUrl = tripId 
      ? `ws://${window.location.host.split(":")[0]}:8000/ws/public/${groupId}/passenger/${tripId}/?token=${token}`
      : `ws://${window.location.host.split(":")[0]}:8000/ws/public/${groupId}/passenger/?token=${token}`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setWsStatus("connected");
      reconnectAttempts.current = 0;
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Handle both new (city_vehicle_update) and legacy (university_vehicle_update) event types
      if (
        data.type === "city_vehicle_update" ||
        data.type === "university_vehicle_update" ||
        data.type === "vehicle_update"
      ) {
        setBuses((prev) => ({
          ...prev,
          [data.trip_id]: {
            ...prev[data.trip_id],
            pos: [data.lat, data.lon],
            bus_number: data.bus_number,
            route_id: data.route_id,
            next_stop_eta: data.next_stop_eta,
          },
        }));
      } else if (data.type === "vehicle_stopped") {
        setBuses((prev) => {
          const next = { ...prev };
          delete next[data.trip_id];
          return next;
        });
      }
    };

    ws.current.onclose = () => {
      setWsStatus("disconnected");
      scheduleReconnect(cityId);
    };

    ws.current.onerror = () => {};
  };

  const scheduleReconnect = (cityId) => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    const baseDelay = 1000;
    const delay = Math.min(
      baseDelay * Math.pow(2, reconnectAttempts.current),
      maxReconnectDelay
    );
    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current += 1;
      connectWebSocket(cityId);
    }, delay);
  };

  const cleanupWs = () => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    if (ws.current) {
      ws.current.onclose = null; // Prevent reconnect loop on unmount
      ws.current.close();
    }
  };

  const handleSearchTrips = async () => {
    if (!pickup || !destination) return;
    setIsSearching(true);
    try {
      const res = await api.post("/api/passenger/filtered-trips/", {
        pickup: { lat: pickup.lat, lon: pickup.lon },
        destination: { lat: destination.lat, lon: destination.lon },
      });
      setFilteredTrips(res.data);
    } catch (err) {
      console.error("Failed to filter trips", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Removed automatic search to allow manual trigger via button
  // useEffect(() => {
  //   if (pickup && destination) {
  //     handleSearchTrips();
  //   }
  // }, [pickup, destination]);

  const toggleLocationSharing = () => {
    if (isLocationActive) {
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
        setIsLocationActive(false);
        setLocationError(null);
        setIsHandRaised(false); // Reset hand raise when location off
    } else {
        setIsLocationActive(true);
        setLocationError(null);
        startTracking();
    }
  };

  const toggleHandRaise = () => {
    if (!isLocationActive) return alert("Activate location first to raise hand");
    
    const nextStatus = !isHandRaised;
    setIsHandRaised(nextStatus);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
            type: "toggle_hand_raise",
            lat: myPos?.lat,
            lon: myPos?.lon
        }));
    }
  };

  // Calculate distance to nearest stop for each active trip/route
  useEffect(() => {
    if (!myPos || Object.keys(buses).length === 0) return;

    const newDistances = {};
    Object.entries(buses).forEach(([tripId, bus]) => {
      // Find nearest stop on this trip's route
      if (bus.stops) {
         let min = Infinity;
         bus.stops.forEach(s => {
            const d = L.latLng(myPos.lat, myPos.lon).distanceTo(L.latLng(s.lat, s.lon));
            if (d < min) min = d;
         });
         newDistances[tripId] = min < 1000 ? `${Math.round(min)}m` : `${(min/1000).toFixed(1)}km`;
      }
    });
    setStopDistances(newDistances);
  }, [myPos, buses]);

  const startTracking = () => {
    if (!navigator.geolocation) {
        setLocationError("Geolocation not supported");
        return;
    }
    
    watchId.current = navigator.geolocation.watchPosition(
        async (pos) => {
            const newPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            setMyPos(newPos);
            setLocationError(null); // Clear error on success
            
            // Push to backend via WebSocket instead of HTTP
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ 
                    lat: pos.coords.latitude, 
                    lon: pos.coords.longitude 
                }));
            }
        },
        (err) => {
            console.error("Position error", err);
            let msg = "Location unavailable";
            if (err.code === 1) {
                msg = "Location permission denied";
                setIsLocationActive(false);
                if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            else if (err.code === 2) msg = "Position unavailable (check GPS)";
            else if (err.code === 3) msg = "Location timeout";
            
            setLocationError(msg);
        },
        { 
            enableHighAccuracy: false, // Set to false to increase reliability in diverse environments
            maximumAge: 10000,
            timeout: 10000
        }
    );
  };

  useEffect(() => {
    return () => {
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  if (loading)
    return (
      <div className="p-8 flex items-center justify-center h-screen">
        <RefreshCw className="animate-spin text-blue-500" />
      </div>
    );

  // Only show buses on the map IF a specific trip is selected
  const allBuses = Object.entries(buses)
    .filter(([tripId, b]) => b.pos && selectedTripId === tripId);

  const selectedBus = selectedTripId ? buses[selectedTripId] : null;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <Header />

      <div className="flex-1 w-full relative z-0">
        {/* Floating Status Panel */}
        <div className="absolute top-6 left-6 w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-[1000] border border-white/20 flex flex-col max-h-[calc(100vh-120px)] overflow-hidden transition-all duration-300">
          <div className="bg-slate-900 p-5 rounded-t-2xl text-white flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Bus size={16} className="text-emerald-400" />
                {selectedTripId ? "Live Tracking" : "Public Transport"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === "connected"
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-orange-400"
                  }`}
                />
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                  {wsStatus === "connected" ? "Connection Active" : "Connecting..."}
                </p>
              </div>
            </div>
            {selectedTripId && (
              <button 
                onClick={() => setSelectedTripId(null)}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white font-bold text-[10px] uppercase tracking-wider transition-colors"
              >
                Change Bus
              </button>
            )}
          </div>

          <div className="p-4 overflow-y-auto">
            {!selectedTripId ? (
              <>
                {/* Step 1: Search */}
                <div className="mb-6 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    1. Enter Trip Details
                  </p>
                  <div className="space-y-2">
                    <LocationSearch 
                      placeholder="Enter Pickup Location" 
                      onSelect={(loc) => { setPickup(loc); setFilteredTrips([]); }} 
                    />
                    <div className="flex justify-center">
                      <ArrowRight size={16} className="text-slate-300 rotate-90" />
                    </div>
                    <LocationSearch 
                      placeholder="Enter Destination" 
                      onSelect={(loc) => { setDestination(loc); setFilteredTrips([]); }} 
                    />
                    
                    <button
                      onClick={handleSearchTrips}
                      disabled={!pickup || !destination || isSearching}
                      className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all ${
                        !pickup || !destination
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                      }`}
                    >
                      {isSearching ? (
                        <RefreshCw size={18} className="animate-spin" />
                      ) : (
                        <Search size={18} />
                      )}
                      <span>{isSearching ? "Searching..." : "Search Rides"}</span>
                    </button>
                  </div>
                </div>

                {/* Step 2: List (Filtered) */}
                {(isSearching || filteredTrips.length > 0) && (
                  <div className="mb-6 space-y-3">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                      2. Select a Ride
                    </p>
                    {isSearching ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTrips.map((trip) => (
                          <div 
                            key={trip.trip_id}
                            onClick={() => setSelectedTripId(trip.trip_id)}
                            className="bg-white border-2 border-slate-100 p-3 rounded-xl hover:border-emerald-300 hover:bg-emerald-50 transition-all cursor-pointer shadow-sm group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-slate-800 text-sm group-hover:text-emerald-700">
                                  {trip.bus_number ? `Bus ${trip.bus_number}` : `Vehicle ${trip.vehicle_number}`}
                                </p>
                                <p className="text-[10px] text-slate-500 font-medium">{trip.route_name}</p>
                              </div>
                              <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-black">
                                {Math.ceil(trip.eta_seconds / 60)} MINS
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <MapPin size={12} className="text-emerald-500" />
                              <span>Next: <strong className="text-slate-800">{trip.next_stop}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Step 3: Focused Tracking & Hand Raise */
              <div className="space-y-6">
                <div className="bg-emerald-50 border-2 border-emerald-100 p-4 rounded-2xl">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">
                    Currently Tracking
                  </p>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {selectedBus?.bus_number ? `Bus ${selectedBus.bus_number}` : "Assigned Vehicle"}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">{selectedBus?.route_name || "Public Route"}</p>
                    </div>
                    <div className="bg-white p-2 rounded-xl border border-emerald-100 shadow-sm flex flex-col items-center min-w-[60px]">
                      <span className="text-xs font-black text-emerald-600">
                        {selectedBus?.next_stop_eta?.[0] 
                          ? Math.ceil(selectedBus.next_stop_eta[0].duration_seconds / 60)
                          : "--"}
                      </span>
                      <span className="text-[8px] text-slate-400 font-bold uppercase">Mins</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-slate-700 bg-white/50 p-3 rounded-xl border border-white">
                      <Clock size={16} className="text-emerald-500" />
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Next Stop</p>
                        <p className="font-bold">{selectedBus?.next_stop_eta?.[0]?.stop_name || "Calculating..."}</p>
                      </div>
                    </div>
                    {stopDistances[selectedTripId] && (
                      <div className="flex items-center gap-3 text-sm text-slate-700 bg-white/50 p-3 rounded-xl border border-white">
                        <MapPin size={16} className="text-indigo-500" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Distance to Nearest Stop</p>
                          <p className="font-bold">{stopDistances[selectedTripId]}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Integrated Hand Raise Button */}
                <div className="bg-slate-900 p-5 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Signal Driver
                      </p>
                      <p className="text-xs text-white font-medium">
                        {isHandRaised ? "Driver notified" : "Request bus to stop"}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${isHandRaised ? "bg-amber-400 animate-ping" : "bg-slate-700"}`} />
                  </div>
                  
                  <button
                    onClick={toggleHandRaise}
                    disabled={!isLocationActive}
                    className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
                      isHandRaised
                        ? "bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                        : "bg-white text-slate-900 font-bold hover:bg-slate-100"
                    } ${!isLocationActive ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
                  >
                    <Hand size={20} className={isHandRaised ? "animate-bounce" : ""} />
                    <span className="text-sm font-black uppercase tracking-wider">
                      {isHandRaised ? "Lower Hand" : "Raise Hand To Stop"}
                    </span>
                  </button>
                  
                  {!isLocationActive && (
                    <p className="text-[10px] text-center text-slate-500">
                      Please <span className="text-slate-300 font-bold">Start Location Sharing</span> to use this feature
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Global Location sharing toggle (Always at bottom) */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    My Location Status
                  </p>
                  <p className="text-xs font-bold text-slate-700">
                    {locationError ? (
                      <span className="text-red-500">{locationError}</span>
                    ) : (
                      isLocationActive ? "Sharing Live" : "Not Sharing"
                    )}
                  </p>
                </div>
                <button
                  onClick={toggleLocationSharing}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    isLocationActive
                      ? "bg-red-100 text-red-600"
                      : "bg-indigo-600 text-white"
                  }`}
                >
                  {isLocationActive ? "Stop" : "Start"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <MapContainer
          center={[20.5937, 78.9629]} // Default: center of India
          zoom={12}
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

          <AutoZoom 
            routeLine={[]} 
            buses={allBuses.reduce((acc, [id, b]) => ({...acc, [id]: b}), {})} 
            myPos={myPos} 
            pickup={pickup} 
            destination={destination} 
          />

          {/* Pickup and Destination Pins */}
          {pickup && (
            <CircleMarker
              center={[pickup.lat, pickup.lon]}
              radius={8}
              pathOptions={{
                color: "white",
                fillColor: "#10b981",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>Pickup: {pickup.display_name}</Popup>
            </CircleMarker>
          )}

          {destination && (
            <CircleMarker
              center={[destination.lat, destination.lon]}
              radius={8}
              pathOptions={{
                color: "white",
                fillColor: "#ef4444",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>Destination: {destination.display_name}</Popup>
            </CircleMarker>
          )}

          {/* My position */}
          {myPos && (
            <CircleMarker
              center={[myPos.lat, myPos.lon]}
              radius={7}
              pathOptions={{
                color: "white",
                fillColor: "#4f46e5",
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
          )}

          {/* Active buses (filtered if one is selected) */}
          {allBuses.map(([tripId, bus]) => (
            <React.Fragment key={tripId}>
              {/* Pulsing aura */}
              <CircleMarker
                center={bus.pos}
                radius={18}
                pathOptions={{
                  color: "transparent",
                  fillColor: "#ef4444",
                  fillOpacity: 0.15,
                  weight: 0,
                }}
              />
              <CircleMarker
                center={bus.pos}
                radius={10}
                pathOptions={{
                  color: "white",
                  fillColor: "#ef4444",
                  fillOpacity: 1,
                  weight: 3,
                }}
              >
                <Popup>
                  <div className="text-center font-bold text-slate-800">
                    {bus.bus_number ? `Bus ${bus.bus_number}` : "Public Bus"}
                  </div>
                  {bus.route_name && (
                    <div className="text-xs text-slate-500 text-center">
                      {bus.route_name}
                    </div>
                  )}
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
