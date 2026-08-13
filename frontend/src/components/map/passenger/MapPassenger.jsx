// VAYY | src/components/Maps/MapPassenger.jsx | Status: ✅ Public Transport Refactor
// Passenger can see ALL active public buses — no assignment needed.

import React, { useState, useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api, { getWsUrl } from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import { Navigation, Clock, Bus, RefreshCw, MapPin, Hand, Search, ArrowRight } from "lucide-react";
import Header from "../../layout/Header";
import LocationSearch from "../LocationSearch";
import ProximityAlertModal from "../../passenger/ProximityAlertModal";
import { getDistanceMeters } from "../../../maps/utils/geo";

const formatDistance = (meters) =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;

const MapPassenger = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [buses, setBuses] = useState({}); // { trip_id: { pos: [lat, lon], bus_number: "...", eta: [..] } }
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [myPos, setMyPos] = useState(null); // { lat, lon }
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [stopDistances, setStopDistances] = useState({}); // { route_id: distance_string }
  const [activeAlert, setActiveAlert] = useState(null);
  
  // New state for filtered trips
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [nearestStop, setNearestStop] = useState(null);

  const ws = useRef(null);
  const watchId = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000;

  const markers = useRef({}); // { type_id: markerInstance }

  // Initialize Map
  useEffect(() => {
    if (loading || map.current || !mapContainer.current) return;
    
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [78.9629, 20.5937], // India center [lon, lat]
      zoom: 4,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    map.current.on("load", () => {
      map.current.addSource("nearest-stop-path", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.current.addLayer({
        id: "nearest-stop-path",
        type: "line",
        source: "nearest-stop-path",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#4f46e5",
          "line-width": 4,
          "line-dasharray": [0.3, 1.6],
          "line-opacity": 0.9,
        },
      });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [loading]);

  // Sync Markers and Bounds
  useEffect(() => {
    if (!map.current) return;

    const points = [];
    if (myPos) points.push([myPos.lon, myPos.lat]);
    if (pickup) points.push([pickup.lon, pickup.lat]);
    if (destination) points.push([destination.lon, destination.lat]);
    if (nearestStop) points.push([nearestStop.lon, nearestStop.lat]);

    // Update MyPos Marker
    if (myPos) {
      if (!markers.current["me"]) {
        const el = document.createElement("div");
        el.className = "my-pos-marker";
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#00E676";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
        
        markers.current["me"] = new maplibregl.Marker({ element: el })
          .setLngLat([myPos.lon, myPos.lat])
          .setPopup(new maplibregl.Popup().setText("You are here"))
          .addTo(map.current);
      } else {
        markers.current["me"].setLngLat([myPos.lon, myPos.lat]);
      }
    } else if (markers.current["me"]) {
      markers.current["me"].remove();
      delete markers.current["me"];
    }

    // Update Pickup Marker
    if (pickup) {
      if (!markers.current["pickup"]) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#10b981";
        el.style.border = "3px solid white";
        
        markers.current["pickup"] = new maplibregl.Marker({ element: el })
          .setLngLat([pickup.lon, pickup.lat])
          .setPopup(new maplibregl.Popup().setText(`Pickup: ${pickup.display_name}`))
          .addTo(map.current);
      } else {
        markers.current["pickup"].setLngLat([pickup.lon, pickup.lat]);
      }
    } else if (markers.current["pickup"]) {
      markers.current["pickup"].remove();
      delete markers.current["pickup"];
    }

    // Update Destination Marker
    if (destination) {
      if (!markers.current["destination"]) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#ef4444";
        el.style.border = "3px solid white";
        
        markers.current["destination"] = new maplibregl.Marker({ element: el })
          .setLngLat([destination.lon, destination.lat])
          .setPopup(new maplibregl.Popup().setText(`Destination: ${destination.display_name}`))
          .addTo(map.current);
      } else {
        markers.current["destination"].setLngLat([destination.lon, destination.lat]);
      }
    } else if (markers.current["destination"]) {
      markers.current["destination"].remove();
      delete markers.current["destination"];
    }

    if (nearestStop) {
      if (!markers.current["nearest-stop"]) {
        const el = document.createElement("div");
        el.style.width = "18px";
        el.style.height = "18px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#4f46e5";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 0 6px rgba(79,70,229,0.15)";

        markers.current["nearest-stop"] = new maplibregl.Marker({ element: el })
          .setLngLat([nearestStop.lon, nearestStop.lat])
          .setPopup(new maplibregl.Popup().setText(`Nearest stop: ${nearestStop.name}`))
          .addTo(map.current);
      } else {
        markers.current["nearest-stop"].setLngLat([nearestStop.lon, nearestStop.lat]);
      }
    } else if (markers.current["nearest-stop"]) {
      markers.current["nearest-stop"].remove();
      delete markers.current["nearest-stop"];
    }

    const anchor = myPos || pickup;
    const nearestSource = map.current.getSource("nearest-stop-path");
    if (nearestSource) {
      nearestSource.setData({
        type: "FeatureCollection",
        features: anchor && nearestStop ? [{
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [anchor.lon, anchor.lat],
              [nearestStop.lon, nearestStop.lat],
            ],
          },
        }] : [],
      });
    }

    // Update Bus Markers
    const currentBusIds = new Set();
    Object.entries(buses).forEach(([tripId, bus]) => {
      if (bus.pos && (!selectedTripId || selectedTripId === tripId)) {
        currentBusIds.add(tripId);
        points.push([bus.pos[1], bus.pos[0]]); // lon, lat

        if (!markers.current[`bus-${tripId}`]) {
          // Initialize marker
          const el = document.createElement("div");
          el.className = "bus-marker";
          el.style.width = "20px";
          el.style.height = "20px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#ef4444";
          el.style.border = "3px solid white";
          
          markers.current[`bus-${tripId}`] = {
            marker: new maplibregl.Marker({ element: el })
              .setLngLat([bus.pos[1], bus.pos[0]])
              .addTo(map.current),
            targetPos: [bus.pos[1], bus.pos[0]],
            startPos: [bus.pos[1], bus.pos[0]],
            startTime: null
          };
        } else {
          // Animate to new position
          const m = markers.current[`bus-${tripId}`];
          m.startPos = m.marker.getLngLat().toArray();
          m.targetPos = [bus.pos[1], bus.pos[0]];
          m.startTime = performance.now();
        }
      }
    });

    // Animation Loop
    const animate = (time) => {
      let active = false;
      Object.entries(markers.current).forEach(([key, m]) => {
        if (key.startsWith("bus-") && m.startTime) {
          const elapsed = time - m.startTime;
          const duration = 3000; // 3 seconds
          const progress = Math.min(elapsed / duration, 1);
          
          const lat = m.startPos[1] + (m.targetPos[1] - m.startPos[1]) * progress;
          const lon = m.startPos[0] + (m.targetPos[0] - m.startPos[0]) * progress;
          
          m.marker.setLngLat([lon, lat]);
          
          if (progress < 1) active = true;
          else m.startTime = null;
        }
      });
      if (active) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    // Remove old bus markers
    Object.keys(markers.current).forEach(key => {
      if (key.startsWith("bus-") && !currentBusIds.has(key.replace("bus-", ""))) {
        markers.current[key].marker.remove();
        delete markers.current[key];
      }
    });

    // Fit Bounds if points exist
    if (points.length > 0) {
      const bounds = points.reduce((acc, coord) => acc.extend(coord), new maplibregl.LngLatBounds(points[0], points[0]));
      map.current.fitBounds(bounds, { padding: 80, duration: 1500 });
    }
  }, [myPos, pickup, destination, buses, selectedTripId, nearestStop]);

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
      const res = await api.get(API_PATHS.operations.trips);
      // Populate initial buses from REST so map is populated even before WS connects
      const tripData = res.data;
      const tripsList = Array.isArray(tripData) ? tripData
        : Array.isArray(tripData?.results) ? tripData.results
        : Array.isArray(tripData?.active_trips) ? tripData.active_trips
        : Array.isArray(tripData?.data) ? tripData.data
        : [];
      const initialBuses = {};
      tripsList.forEach((trip) => {
        initialBuses[trip.id || trip.trip_id] = {
          pos: null, // position comes from WS
          bus_number: trip.bus_number || trip.vehicle_number,
          route_name: trip.route_name || trip.route?.name,
          route_id: trip.id || trip.trip_id,
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

    const token = localStorage.getItem("access_token");
    // Use the new public WS URL; if no cityId, connect to global 'public' group
    const groupId = cityId || "public";

    // Add tripId to the WebSocket URL if selected
    const wsUrl = tripId 
      ? getWsUrl(`/ws/public/${groupId}/passenger/${tripId}/?token=${token}`)
      : getWsUrl(`/ws/public/${groupId}/passenger/?token=${token}`);

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setWsStatus("connected");
      reconnectAttempts.current = 0;
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 1. Handle v_delta (New optimized format)
      if (data.type === "v_delta") {
        setBuses((prev) => ({
          ...prev,
          [data.id]: {
            ...prev[data.id],
            pos: [data.lat, data.lon],
            // h is heading, d is delay
            next_stop_eta: data.eta || [],
          },
        }));
      } 
      // 2. Handle legacy/explicit updates
      else if (
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
      } else if (data.type === "proximity_alert") {
         setActiveAlert(data);
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
      const res = await api.get(API_PATHS.transport.routeSearchByLocation, {
        params: {
          origin_lat: pickup.lat,
          origin_lng: pickup.lon,
          dest_lat: destination.lat,
          dest_lng: destination.lon,
        },
      });
      const raw = res.data;
      const trips = Array.isArray(raw) ? raw : (raw?.data || raw?.results || []);
      setFilteredTrips(trips);
    } catch (err) {
      console.error("Failed to filter trips", err);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchNearestStop = useCallback(async (location) => {
    if (!location) {
      setNearestStop(null);
      return;
    }

    try {
      const res = await api.get(
        `${API_PATHS.transport.nearbyStops}?lat=${location.lat}&lng=${location.lon}&radius=3000`,
      );
      const stops = Array.isArray(res.data) ? res.data : [];
      const anchor = myPos || location;
      const nearest = stops
        .map((stop) => {
          const distanceMeters = getDistanceMeters(
            [anchor.lat, anchor.lon],
            [Number(stop.lat), Number(stop.lon)],
          );
          return {
            ...stop,
            lat: Number(stop.lat),
            lon: Number(stop.lon),
            distanceMeters,
            distanceText: formatDistance(distanceMeters),
          };
        })
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
      setNearestStop(nearest || null);
    } catch (err) {
      console.error("Failed to load nearest stop", err);
      setNearestStop(null);
    }
  }, [myPos]);

  useEffect(() => {
    fetchNearestStop(pickup);
  }, [pickup, fetchNearestStop]);

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
            // Simple Haversine approx for distance (or use turf)
            const d = Math.sqrt(Math.pow(myPos.lat - s.lat, 2) + Math.pow(myPos.lon - s.lon, 2)) * 111320; 
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
            enableHighAccuracy: false, 
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

  const selectedBus = selectedTripId ? buses[selectedTripId] : null;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans">
      <Header />
      <ProximityAlertModal alert={activeAlert} onClose={() => setActiveAlert(null)} />

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
                  {nearestStop && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm text-slate-700">
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="mt-0.5 text-indigo-600" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                            Nearest Stop
                          </p>
                          <p className="truncate font-bold text-slate-900">{nearestStop.name}</p>
                          <p className="text-xs font-medium text-slate-500">
                            {nearestStop.distanceText} from {myPos ? "your live location" : "pickup"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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
                    {nearestStop && (
                      <div className="flex items-center gap-3 text-sm text-slate-700 bg-white/50 p-3 rounded-xl border border-white">
                        <Navigation size={16} className="text-indigo-500" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Walk to Stop</p>
                          <p className="font-bold">{nearestStop.distanceText} via dotted path</p>
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
        <div ref={mapContainer} className="h-full w-full" />
      </div>
    </div>
  );
};

export default MapPassenger;
