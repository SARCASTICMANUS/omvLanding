// import React, { useState, useRef, useEffect } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   Polyline,
//   CircleMarker,
//   Popup,
//   useMap,
// } from "react-leaflet";
// import LocationSearch from "./LocationSearch";
// import axios from "axios";
// import { Play, Navigation } from "lucide-react";

// // Helper to auto-zoom map
// const MapUpdater = ({ bounds }) => {
//   const map = useMap();
//   useEffect(() => {
//     if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
//   }, [bounds, map]);
//   return null;
// };

// const MapDriver = () => {
//   const [start, setStart] = useState(null);
//   const [end, setEnd] = useState(null);
//   const [routePath, setRoutePath] = useState(null); // Array of [lat, lon]
//   const [tripData, setTripData] = useState(null); // { trip_id, etc }
//   const [passengerCount, setPassengerCount] = useState(0);
//   const [isDriving, setIsDriving] = useState(false);
//   const [currentPos, setCurrentPos] = useState(null);

//   const ws = useRef(null);

//   // Create Route Logic
//   const handleCreateRoute = async () => {
//     if (!start || !end) return;
//     try {
//       const payload = {
//         start: { lat: start.lat, lon: start.lon },
//         end: { lat: end.lat, lon: end.lon },
//         start_name: start.display_name,
//         end_name: end.display_name,
//         vehicle_type: "car",
//       };

//       const res = await axios.post(
//         "http://localhost:8000/api/driver/start-trip/",
//         payload,
//       );

//       // Backend returns LineString coords as [[lon, lat], ...]. Leaflet needs [lat, lon]
//       const latLonPath = res.data.route_geometry.map((coord) => [
//         coord[1],
//         coord[0],
//       ]);

//       setRoutePath(latLonPath);
//       setTripData(res.data);
//       setCurrentPos([start.lat, start.lon]);
//     } catch (err) {
//       console.error("Route creation failed", err);
//       alert("Failed to calculate route. Ensure backend OSRM is running.");
//     }
//   };

//   // Start Driving (Simulate)
//   const startDrive = () => {
//     if (!tripData || !routePath) return;
//     setIsDriving(true);

//     // Connect WebSocket
//     const wsUrl = `ws://localhost:8000/ws/trip/${tripData.trip_id}/driver/`;
//     ws.current = new WebSocket(wsUrl);

//     ws.current.onmessage = (event) => {
//       const data = JSON.parse(event.data);
//       if (data.type === "stats_update") {
//         setPassengerCount(data.passenger_count);
//       }
//     };

//     // Simulation Loop (Move along path)
//     let index = 0;
//     const interval = setInterval(() => {
//       if (index >= routePath.length) {
//         clearInterval(interval);
//         alert("Trip Complete");
//         setIsDriving(false);
//         return;
//       }

//       const pos = routePath[index];
//       setCurrentPos(pos);

//       // Send Update
//       if (ws.current && ws.current.readyState === WebSocket.OPEN) {
//         ws.current.send(JSON.stringify({ lat: pos[0], lon: pos[1] }));
//       }

//       // Jump 5 nodes at a time to simulate speed
//       index += 5;
//     }, 2000);
//   };

//   return (
//     <div className="h-full relative">
//       {/* Control Panel Overlay */}
//       <div className="absolute top-4 left-4 w-96 bg-white rounded-xl shadow-xl z-[1000] p-4 flex flex-col gap-4">
//         <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
//           <Navigation size={20} className="text-blue-600" /> Driver Console
//         </h2>

//         {!isDriving && (
//           <>
//             <LocationSearch placeholder="Start Point (A)" onSelect={setStart} />
//             <LocationSearch placeholder="End Point (G)" onSelect={setEnd} />

//             {start && end && !routePath && (
//               <button
//                 onClick={handleCreateRoute}
//                 className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
//               >
//                 Create Route
//               </button>
//             )}
//           </>
//         )}

//         {/* Confirmation & Stats */}
//         {routePath && (
//           <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
//             <div className="flex justify-between items-center mb-4">
//               <span className="text-blue-800 font-bold">Route Ready</span>
//               <span className="text-sm text-blue-600">
//                 {(tripData?.total_distance_meters / 1000)?.toFixed(1)} km
//               </span>
//             </div>

//             {!isDriving ? (
//               <button
//                 onClick={startDrive}
//                 className="w-full bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700"
//               >
//                 <Play size={18} /> Start Drive
//               </button>
//             ) : (
//               <div className="text-center">
//                 <p className="text-xs text-gray-500 uppercase tracking-wide">
//                   Passengers Waiting
//                 </p>
//                 <p className="text-4xl font-bold text-gray-800">
//                   {passengerCount}
//                 </p>
//                 <p className="text-green-500 text-sm mt-2 animate-pulse">
//                   Broadcasting Location...
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Map */}
//       <MapContainer
//         center={[40.7128, -74.006]}
//         zoom={13}
//         style={{ height: "100%", width: "100%" }}
//       >
//         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//         {/* Draw Route */}
//         {routePath && (
//           <Polyline
//             positions={routePath}
//             color="#2563eb"
//             weight={6}
//             opacity={0.7}
//           />
//         )}

//         {/* Start Point A - Green Circle */}
//         {start && (
//           <CircleMarker
//             center={[start.lat, start.lon]}
//             radius={8}
//             pathOptions={{ color: "green", fillColor: "white", fillOpacity: 1 }}
//           />
//         )}

//         {/* End Point G - Red Circle */}
//         {end && (
//           <CircleMarker
//             center={[end.lat, end.lon]}
//             radius={8}
//             pathOptions={{ color: "red", fillColor: "white", fillOpacity: 1 }}
//           />
//         )}

//         {/* Moving Vehicle - Blue Pulsing Circle */}
//         {currentPos && (
//           <>
//             <CircleMarker
//               center={currentPos}
//               radius={10}
//               pathOptions={{
//                 color: "white",
//                 fillColor: "#2563eb",
//                 fillOpacity: 1,
//               }}
//             >
//               <Popup>You</Popup>
//             </CircleMarker>
//             <MapUpdater bounds={routePath ? L.latLngBounds(routePath) : null} />
//           </>
//         )}
//       </MapContainer>
//     </div>
//   );
// };

// import L from "leaflet"; // Import for bounds calculation
// export default MapDriver;

import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import api from "../utils/api";
import { Play, Navigation, Bus, MapPin, Search } from "lucide-react";

// Helper to auto-zoom map
const MapUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

const MapDriver = ({ onBack }) => {
  const { user } = useSelector((state) => state.auth);

  // State for Route Selection
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // State for Active Trip
  const [routePath, setRoutePath] = useState(null); // Array of [lat, lon]
  const [tripData, setTripData] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);

  // State for Driving/Status
  const [isDriving, setIsDriving] = useState(false);
  const [passengerCount, setPassengerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const ws = useRef(null);

  // 1. Fetch Available Routes on Mount (Scoped by University)
  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await api.get("/api/driver/routes/");
      setAvailableRoutes(res.data);
    } catch (err) {
      console.error("Failed to load routes", err);
    }
  };

  // 2. Load Selected Route from Backend
  const handleLoadRoute = async () => {
    if (!selectedRouteId) return;
    setLoading(true);
    try {
      const res = await api.post("/api/driver/start-trip/", {
        route_id: selectedRouteId,
        vehicle_type: user?.role === "driver" ? "bus" : "car",
      });

      const path = res.data.route_geometry;
      setRoutePath(path);
      setTripData(res.data);

      if (path && path.length > 0) {
        setCurrentPos(path[0]);
      }
    } catch (err) {
      console.error(err);
      alert("Error loading route. Make sure OSRM is running.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Start Driving Simulation & WebSocket
  const startDrive = () => {
    if (!tripData || !routePath || !user?.university) return;
    setIsDriving(true);

    // Dynamic WS URL: ws/tracking/<univ_id>/driver/<trip_id>/
    const wsUrl = `ws://localhost:8000/ws/tracking/${user.university}/driver/${tripData.trip_id}/`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("Broadcasting to University Transit Group");
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "stats_update") {
        setPassengerCount(data.passenger_count);
      }
    };

    // Simulation Loop
    let index = 0;
    const interval = setInterval(() => {
      if (index >= routePath.length) {
        clearInterval(interval);
        alert("Trip Complete");
        setIsDriving(false);
        ws.current.close();
        return;
      }

      const pos = routePath[index];
      setCurrentPos(pos);

      // Broadcast Location
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            lat: pos[0],
            lon: pos[1],
            vehicle_number: user?.email.split("@")[0].toUpperCase(), // Placeholder/Fallback
          }),
        );
      }

      index += 2; // Simulation speed
    }, 1000);
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (ws.current) ws.current.close();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const stopDrive = () => {
    if (confirm("End this trip?")) {
      if (ws.current) ws.current.close();
      setIsDriving(false);
      setRoutePath(null);
      setTripData(null);
    }
  };

  const filteredRoutes = availableRoutes.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="h-full relative font-sans">
      <div className="absolute top-4 left-4 w-96 bg-white rounded-2xl shadow-2xl z-[1000] overflow-hidden flex flex-col border border-slate-100 ring-1 ring-slate-900/5">
        <div className="bg-indigo-600 p-5 text-white">
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-black text-xl flex items-center gap-2 tracking-tight">
              <Navigation size={22} className="rotate-45" /> Driver Center
            </h2>
            <button
              onClick={onBack}
              className="text-[10px] uppercase tracking-widest font-black opacity-70 hover:opacity-100"
            >
              Exit
            </button>
          </div>
          <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest">
            {user?.university_name || "University Transit"}
          </p>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {!isDriving && !routePath && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="relative group">
                <Search
                  className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
                  size={18}
                />
                <input
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-sm"
                  placeholder="Search shift route..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredRoutes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRouteId(r.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${selectedRouteId === r.id ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-50 bg-slate-50/50 hover:border-slate-200 text-slate-600"}`}
                  >
                    <div>
                      <p className="font-black text-xs uppercase tracking-tight">
                        {r.name}
                      </p>
                      <p className="text-[10px] opacity-70 font-bold">
                        {r.stops_count} Official Stops
                      </p>
                    </div>
                    {selectedRouteId === r.id && (
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleLoadRoute}
                disabled={!selectedRouteId || loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl hover:shadow-indigo-500/30 disabled:bg-slate-200 disabled:shadow-none"
              >
                {loading ? "Syncing..." : "Assign Vehicle"}
              </button>
            </div>
          )}

          {routePath && !isDriving && (
            <div className="animate-in zoom-in-95 duration-300">
              <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl mb-5 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase tracking-widest mb-2">
                  <MapPin size={16} /> Route Optimized
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter">
                      Distance
                    </p>
                    <p className="font-black text-emerald-900 text-lg">
                      {(tripData?.total_distance / 1000)?.toFixed(1)} km
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter">
                      Est. Time
                    </p>
                    <p className="font-black text-emerald-900 text-lg">
                      ~15 Mins
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={startDrive}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition shadow-2xl flex items-center justify-center gap-3"
              >
                <Play size={20} fill="currentColor" /> Go Online
              </button>

              <button
                onClick={() => {
                  setRoutePath(null);
                  setSelectedRouteId("");
                }}
                className="w-full mt-4 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-red-500 transition"
              >
                Reset Shift
              </button>
            </div>
          )}

          {isDriving && (
            <div className="text-center py-6 animate-in fade-in duration-500">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20" />
                <div className="relative p-6 bg-indigo-100 rounded-full">
                  <Navigation size={40} className="text-indigo-600" />
                </div>
              </div>

              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-1">
                Live Tracking
              </h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-8">
                Broadcasting Presence
              </p>

              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Nearby Commuters
                </p>
                <p className="text-6xl font-black text-indigo-600 tracking-tighter">
                  {passengerCount}
                </p>
              </div>

              <button
                onClick={stopDrive}
                className="w-full mt-8 bg-red-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-700 transition shadow-xl hover:shadow-red-500/30"
              >
                End Trip
              </button>
            </div>
          )}
        </div>
      </div>

      <MapContainer
        center={currentPos || [12.9716, 77.5946]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {routePath && (
          <Polyline
            positions={routePath}
            color="#4f46e5"
            weight={8}
            opacity={0.6}
          />
        )}
        {currentPos && (
          <CircleMarker
            center={currentPos}
            radius={12}
            pathOptions={{
              color: "white",
              fillColor: "#4f46e5",
              fillOpacity: 1,
              weight: 4,
            }}
          >
            <Popup className="font-sans font-bold">You are here</Popup>
          </CircleMarker>
        )}
        <MapUpdater bounds={routePath} />
      </MapContainer>
    </div>
  );
};

export default MapDriver;
