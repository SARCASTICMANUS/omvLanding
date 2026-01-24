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
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import { Play, Navigation, Bus, MapPin } from "lucide-react";

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
  // State for Route Selection
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");

  // State for Active Trip
  const [routePath, setRoutePath] = useState(null); // Array of [lat, lon]
  const [tripData, setTripData] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);

  // State for Driving/Status
  const [isDriving, setIsDriving] = useState(false);
  const [passengerCount, setPassengerCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const ws = useRef(null);

  // 1. Fetch Available Routes on Mount
  useEffect(() => {
    axios
      .get("http://localhost:8000/api/driver/routes/")
      .then((res) => {
        setAvailableRoutes(res.data);
      })
      .catch((err) => console.error("Failed to load routes", err));
  }, []);

  // 2. Load Selected Route from Backend
  const handleLoadRoute = async () => {
    if (!selectedRouteId) return;
    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:8000/api/driver/start-trip/",
        {
          route_id: selectedRouteId,
          vehicle_type: "bus", // Defaulting to bus for fixed routes
        },
      );

      // Backend now sends [[lat, lon], ...] ready for Leaflet
      const path = res.data.route_geometry;

      setRoutePath(path);
      setTripData(res.data);

      // Set initial position to start of route
      if (path && path.length > 0) {
        setCurrentPos(path[0]);
      }
    } catch (err) {
      console.error(err);
      alert("Error loading route. Make sure OSRM and Backend are running.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Start Driving Simulation & WebSocket
  const startDrive = () => {
    if (!tripData || !routePath) return;
    setIsDriving(true);

    // Connect WebSocket
    const wsUrl = `ws://localhost:8000/ws/trip/${tripData.trip_id}/driver/`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("Driver connected to tracking server");
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Listen for passenger count updates
      if (data.type === "stats_update") {
        setPassengerCount(data.passenger_count);
      }
    };

    // Simulation Loop: Move along the path array
    let index = 0;
    const interval = setInterval(() => {
      if (index >= routePath.length) {
        clearInterval(interval);
        alert("Trip Complete - Reached Destination");
        setIsDriving(false);
        ws.current.close();
        return;
      }

      const pos = routePath[index];
      setCurrentPos(pos);

      // Broadcast Location
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ lat: pos[0], lon: pos[1] }));
      }

      // Speed factor: Jump 3 coordinates every 1 second
      index += 3;
    }, 1000);
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      // If driving, close the socket immediately to trigger backend disconnect logic
      if (ws.current) {
        ws.current.close();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const stopDrive = () => {
    if (confirm("End this trip? Passengers will be notified.")) {
      // Close socket -> Triggers 'disconnect' in Backend -> Sets DB is_active=False
      if (ws.current) ws.current.close();

      setIsDriving(false);
      setRoutePath(null);
      setTripData(null);
      setPassengerCount(0);
      // Optional: Notify backend via API to be double sure (redundancy)
      // axios.post('/api/driver/stop-trip', { trip_id: ... })
    }
  };

  return (
    <div className="h-full relative font-sans">
      {/* --- Sidebar Control Panel --- */}
      <div className="absolute top-4 left-4 w-96 bg-white rounded-xl shadow-2xl z-[1000] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Navigation size={20} /> Driver Console
          </h2>
          {onBack && (
            <button
              onClick={onBack}
              className="text-xs hover:underline opacity-80"
            >
              Exit
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* STAGE 1: Route Selection */}
          {!isDriving && !routePath && (
            <>
              <div className="text-sm text-gray-500">
                Select a pre-defined route to begin your shift.
              </div>

              <div className="relative">
                <Bus
                  className="absolute left-3 top-3 text-gray-400"
                  size={18}
                />
                <select
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={selectedRouteId}
                  onChange={(e) => setSelectedRouteId(e.target.value)}
                >
                  <option value="">-- Select Route --</option>
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
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:bg-gray-300"
              >
                {loading ? "Loading Geometry..." : "Load Route"}
              </button>
            </>
          )}

          {/* STAGE 2: Ready to Drive */}
          {routePath && !isDriving && (
            <div className="animate-fade-in">
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-blue-800 font-bold mb-1">
                  <MapPin size={16} /> Route Loaded
                </div>
                <div className="text-sm text-blue-600">
                  Total Distance:{" "}
                  {(tripData?.total_distance / 1000)?.toFixed(1)} km
                </div>
              </div>

              <button
                onClick={startDrive}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Play size={20} fill="currentColor" /> Start Engine
              </button>

              <button
                onClick={() => {
                  setRoutePath(null);
                  setSelectedRouteId("");
                }}
                className="w-full mt-2 text-gray-400 text-xs hover:text-red-500"
              >
                Cancel & Select Different Route
              </button>
            </div>
          )}

          {/* STAGE 3: Driving Mode */}
          {isDriving && (
            <div className="text-center py-4">
              <div className="inline-block p-3 bg-blue-100 rounded-full mb-2 animate-pulse">
                <Navigation size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800">
                Trip in Progress
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Broadcasting location to passengers...
              </p>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <p className="text-xs font-bold text-gray-400 uppercase">
                  Passengers Nearby
                </p>
                <p className="text-5xl font-extrabold text-blue-600 mt-1">
                  {passengerCount}
                </p>
              </div>
            </div>
          )}

          {isDriving && (
            <div className="mt-4">
              <button
                onClick={stopDrive}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition shadow-lg animate-pulse"
              >
                STOP TRIP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- Map View --- */}
      <MapContainer
        center={[40.7128, -74.006]} // Default view (NYC) if no route
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false} // Hide default zoom controls for cleaner look
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* The Route Line */}
        {routePath && (
          <Polyline
            positions={routePath}
            color="#2563eb"
            weight={6}
            opacity={0.8}
          />
        )}

        {/* Start/End Markers */}
        {routePath && routePath.length > 0 && (
          <>
            <CircleMarker
              center={routePath[0]}
              radius={6}
              pathOptions={{
                color: "green",
                fillColor: "white",
                fillOpacity: 1,
              }}
            >
              <Popup>Start</Popup>
            </CircleMarker>
            <CircleMarker
              center={routePath[routePath.length - 1]}
              radius={6}
              pathOptions={{ color: "red", fillColor: "white", fillOpacity: 1 }}
            >
              <Popup>End</Popup>
            </CircleMarker>
          </>
        )}

        {/* The Bus/Car Icon */}
        {currentPos && (
          <CircleMarker
            center={currentPos}
            radius={10}
            pathOptions={{
              color: "white",
              fillColor: "#2563eb",
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>You (Vehicle)</Popup>
          </CircleMarker>
        )}

        {/* Auto-Zoom Helper */}
        <MapUpdater bounds={routePath} />
      </MapContainer>
    </div>
  );
};

export default MapDriver;
