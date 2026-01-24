// import React, { useState, useRef } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   CircleMarker,
//   Popup,
//   useMapEvents,
// } from "react-leaflet";
// import LocationSearch from "./LocationSearch";
// import axios from "axios";
// import { Loader } from "lucide-react";

// // Component to handle map clicks
// const LocationSelector = ({ onLocationSelected }) => {
//   useMapEvents({
//     click(e) {
//       onLocationSelected({
//         lat: e.latlng.lat,
//         lon: e.latlng.lng,
//         display_name: "Selected on Map",
//       });
//     },
//   });
//   return null;
// };

// const MapPassenger = () => {
//   const [myPos, setMyPos] = useState(null);
//   const [matches, setMatches] = useState([]);
//   const [activeTrip, setActiveTrip] = useState(null);
//   const [vehiclePos, setVehiclePos] = useState(null);
//   const [eta, setEta] = useState(null);
//   const [loading, setLoading] = useState(false);

//   const ws = useRef(null);

//   // 1. Search Logic
//   const handleCheckForVehicles = async () => {
//     if (!myPos) return;
//     setLoading(true);
//     setMatches([]);

//     try {
//       const res = await axios.post(
//         "http://localhost:8000/api/passenger/match/",
//         {
//           lat: myPos.lat,
//           lon: myPos.lon,
//         },
//       );
//       setMatches(res.data); // Returns list of { trip_id, vehicle_type, start, end }
//     } catch (err) {
//       console.error(err);
//       alert("Error finding vehicles.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // 2. Connect to Trip
//   const connectToTrip = (trip) => {
//     setActiveTrip(trip);

//     const wsUrl = `ws://localhost:8000/ws/trip/${trip.trip_id}/passenger/`;
//     ws.current = new WebSocket(wsUrl);

//     ws.current.onopen = () => {
//       // Send initial heartbeat to register presence
//       ws.current.send(JSON.stringify({ lat: myPos.lat, lon: myPos.lon }));
//     };

//     ws.current.onmessage = (event) => {
//       const data = JSON.parse(event.data);

//       if (data.type === "vehicle_update") {
//         setVehiclePos([data.lat, data.lon]);
//       }
//       if (data.type === "eta_update") {
//         setEta(data.data); // { distance, duration }
//       }
//     };
//   };

//   return (
//     <div className="h-full relative">
//       {/* Search Overlay */}
//       <div className="absolute top-4 left-4 w-96 bg-white rounded-xl shadow-xl z-[1000] p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
//         {!activeTrip ? (
//           <>
//             <h2 className="font-bold text-gray-800">Find a Ride</h2>
//             <p className="text-xs text-gray-500">
//               Search below or click on the map to set your location.
//             </p>

//             <LocationSearch
//               placeholder="Where are you? (Point C)"
//               onSelect={setMyPos}
//             />

//             {myPos && (
//               <div className="bg-gray-50 p-3 rounded text-sm text-gray-700 border border-gray-200">
//                 Selected: <strong>{myPos.display_name}</strong>
//               </div>
//             )}

//             <button
//               onClick={handleCheckForVehicles}
//               disabled={!myPos || loading}
//               className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
//             >
//               {loading ? (
//                 <Loader className="animate-spin" size={18} />
//               ) : (
//                 "Scan Road (10m Buffer)"
//               )}
//             </button>

//             {/* Results List */}
//             {matches.length > 0 && (
//               <div className="mt-2 flex flex-col gap-2">
//                 <p className="text-xs font-bold text-gray-500 uppercase">
//                   Found {matches.length} Vehicles
//                 </p>
//                 {matches.map((trip) => (
//                   <button
//                     key={trip.trip_id}
//                     onClick={() => connectToTrip(trip)}
//                     className="text-left bg-green-50 hover:bg-green-100 border border-green-200 p-3 rounded-lg transition"
//                   >
//                     <div className="font-bold text-green-800 capitalize">
//                       {trip.vehicle_type}
//                     </div>
//                     <div className="text-xs text-green-600 truncate">
//                       {trip.start} → {trip.end}
//                     </div>
//                   </button>
//                 ))}
//               </div>
//             )}
//             {matches.length === 0 && !loading && myPos && (
//               <p className="text-sm text-gray-400 text-center mt-2">
//                 No active vehicles nearby.
//               </p>
//             )}
//           </>
//         ) : (
//           /* Active Trip Status Panel */
//           <div className="bg-white rounded-lg">
//             <div className="bg-green-600 text-white p-4 rounded-t-lg">
//               <h3 className="font-bold text-lg">
//                 Inbound {activeTrip.vehicle_type}
//               </h3>
//               <p className="text-green-100 text-xs">
//                 {activeTrip.start} to {activeTrip.end}
//               </p>
//             </div>
//             <div className="p-4 border border-t-0 rounded-b-lg shadow-sm">
//               {eta ? (
//                 <div className="grid grid-cols-2 gap-4 text-center">
//                   <div>
//                     <p className="text-2xl font-bold text-gray-800">
//                       {Math.ceil(eta.duration / 60)}
//                     </p>
//                     <p className="text-xs text-gray-500 uppercase">Minutes</p>
//                   </div>
//                   <div>
//                     <p className="text-2xl font-bold text-gray-800">
//                       {(eta.distance / 1000).toFixed(1)}
//                     </p>
//                     <p className="text-xs text-gray-500 uppercase">Km Away</p>
//                   </div>
//                 </div>
//               ) : (
//                 <p className="text-center text-gray-500 animate-pulse">
//                   Calculating ETA...
//                 </p>
//               )}

//               <button
//                 onClick={() => {
//                   setActiveTrip(null);
//                   setVehiclePos(null);
//                   if (ws.current) ws.current.close();
//                 }}
//                 className="w-full mt-4 border border-red-200 text-red-600 py-2 rounded text-sm hover:bg-red-50"
//               >
//                 Leave Tracker
//               </button>
//             </div>
//           </div>
//         )}
//       </div>

//       <MapContainer
//         center={[40.7128, -74.006]}
//         zoom={13}
//         style={{ height: "100%", width: "100%" }}
//       >
//         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
//         <LocationSelector onLocationSelected={setMyPos} />

//         {/* My Location - Blue */}
//         {myPos && (
//           <CircleMarker
//             center={[myPos.lat, myPos.lon]}
//             radius={8}
//             pathOptions={{
//               color: "white",
//               fillColor: "#2563eb",
//               fillOpacity: 1,
//             }}
//           >
//             <Popup>You</Popup>
//           </CircleMarker>
//         )}

//         {/* Vehicle - Red */}
//         {vehiclePos && (
//           <CircleMarker
//             center={vehiclePos}
//             radius={10}
//             pathOptions={{
//               color: "white",
//               fillColor: "#dc2626",
//               fillOpacity: 1,
//             }}
//           >
//             <Popup>Vehicle</Popup>
//           </CircleMarker>
//         )}
//       </MapContainer>
//     </div>
//   );
// };

// export default MapPassenger;

// import React, { useState, useRef, useEffect } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   CircleMarker,
//   Polyline,
//   Popup,
//   useMapEvents,
//   useMap,
// } from "react-leaflet";
// import LocationSearch from "./LocationSearch";
// import axios from "axios";
// import { Loader, MapPin, Navigation, AlertCircle } from "lucide-react";
// import L from "leaflet";

// // --- Helper: Auto Zoom to Match ---
// const AutoZoom = ({ routePath, myPos }) => {
//   const map = useMap();
//   useEffect(() => {
//     if (routePath && routePath.length > 0) {
//       // Fit to the route
//       const bounds = L.latLngBounds(routePath);
//       // Extend bounds to include user if they are far off
//       if (myPos) bounds.extend([myPos.lat, myPos.lon]);
//       map.fitBounds(bounds, { padding: [50, 50] });
//     }
//   }, [routePath, myPos, map]);
//   return null;
// };

// // --- Component to handle map clicks ---
// const LocationSelector = ({ onLocationSelected }) => {
//   useMapEvents({
//     click(e) {
//       onLocationSelected({
//         lat: e.latlng.lat,
//         lon: e.latlng.lng,
//         display_name: "Selected Location",
//       });
//     },
//   });
//   return null;
// };

// const MapPassenger = ({ onBack }) => {
//   const [myPos, setMyPos] = useState(null);
//   const [matches, setMatches] = useState([]);
//   const [activeTrip, setActiveTrip] = useState(null);

//   // Active Trip Data
//   const [vehiclePos, setVehiclePos] = useState(null);
//   const [routePath, setRoutePath] = useState(null); // The LineString of the route
//   const [eta, setEta] = useState(null);
//   const [loading, setLoading] = useState(false);

//   const ws = useRef(null);

//   // 1. Search for Active Trips near me
//   const handleCheckForVehicles = async () => {
//     if (!myPos) return;
//     setLoading(true);
//     setMatches([]);

//     try {
//       // API checks for Routes within 10m of the passenger that have an ActiveTrip
//       const res = await axios.post(
//         "http://localhost:8000/api/passenger/match/",
//         {
//           lat: myPos.lat,
//           lon: myPos.lon,
//         },
//       );
//       setMatches(res.data);
//     } catch (err) {
//       console.error(err);
//       alert("Error scanning for vehicles. Ensure backend is running.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // 2. Connect to a specific Trip
//   // const connectToTrip = async (trip) => {
//   //   setActiveTrip(trip);

//   //   // We need to fetch the Route Geometry to draw the line
//   //   // (Assuming the match API returns route ID, we might need a separate call or include it in match response)
//   //   // For now, let's assume the match endpoint includes basic route details,
//   //   // but if we want the full path, we might need to query the route detail.
//   //   // *Optimization: Ideally /match returns the path, or we fetch it here.*

//   //   // For this implementation, let's just clear previous path until we get data
//   //   // OR we can pass it if the backend provides it.
//   //   // Let's assume the backend 'match' endpoint returns simplified data, so we might not have the full path immediately.
//   //   // If you strictly need the path, you would fetch it here: axios.get(`/api/routes/${trip.route_id}`)

//   //   const wsUrl = `ws://localhost:8000/ws/trip/${trip.trip_id}/passenger/`;
//   //   ws.current = new WebSocket(wsUrl);

//   //   ws.current.onopen = () => {
//   //     // Send initial heartbeat to register presence
//   //     ws.current.send(JSON.stringify({ lat: myPos.lat, lon: myPos.lon }));
//   //   };

//   //   ws.current.onmessage = (event) => {
//   //     const data = JSON.parse(event.data);

//   //     if (data.type === "vehicle_update") {
//   //       setVehiclePos([data.lat, data.lon]);
//   //     }
//   //     if (data.type === "eta_update") {
//   //       setEta(data.data); // { distance, duration }
//   //     }
//   //   };
//   // };

//   const connectToTrip = (trip) => {
//     setActiveTrip(trip);
//     // ... setup socket ...
//     const wsUrl = `ws://localhost:8000/ws/trip/${trip.trip_id}/passenger/`;
//     ws.current = new WebSocket(wsUrl);

//     ws.current.onmessage = (event) => {
//       const data = JSON.parse(event.data);

//       // Existing handlers
//       if (data.type === "vehicle_update") setVehiclePos([data.lat, data.lon]);
//       if (data.type === "eta_update") setEta(data.data);

//       // NEW: Handle Trip End Event
//       if (data.type === "trip_ended") {
//         alert("The driver has ended the trip.");
//         leaveTrip(); // Reset local state
//       }
//     };

//     // Handle socket errors or unexpected closures
//     ws.current.onclose = (e) => {
//       // If it wasn't a clean close by us
//       if (activeTrip) {
//         console.log("Connection lost");
//         // You might want to try reconnecting or just alert user
//       }
//     };
//   };

//   const leaveTrip = () => {
//     setActiveTrip(null);
//     setVehiclePos(null);
//     setRoutePath(null);
//     setEta(null);
//     if (ws.current) ws.current.close();
//   };

//   return (
//     <div className="h-full relative font-sans">
//       {/* --- Sidebar / Overlay Panel --- */}
//       <div className="absolute top-4 left-4 w-96 bg-white rounded-xl shadow-2xl z-[1000] flex flex-col max-h-[90vh] overflow-hidden">
//         {/* Header */}
//         <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
//           <h2 className="font-bold flex items-center gap-2">
//             <MapPin size={18} className="text-green-400" /> Passenger View
//           </h2>
//           <button onClick={onBack} className="text-xs hover:text-gray-300">
//             Exit
//           </button>
//         </div>

//         <div className="p-4 overflow-y-auto">
//           {!activeTrip ? (
//             <>
//               <div className="mb-4">
//                 <p className="text-sm text-gray-500 mb-2">
//                   Set your location to find vehicles passing by on fixed routes.
//                 </p>
//                 <LocationSearch
//                   placeholder="Search your location..."
//                   onSelect={setMyPos}
//                 />

//                 {myPos && (
//                   <div className="mt-2 text-xs bg-blue-50 text-blue-800 p-2 rounded border border-blue-100 flex items-center gap-2">
//                     <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
//                     Selected:{" "}
//                     <strong>{myPos.display_name?.split(",")[0]}</strong>
//                   </div>
//                 )}
//               </div>

//               <button
//                 onClick={handleCheckForVehicles}
//                 disabled={!myPos || loading}
//                 className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2 shadow-sm"
//               >
//                 {loading ? (
//                   <Loader className="animate-spin" size={18} />
//                 ) : (
//                   "Scan for Vehicles (10m)"
//                 )}
//               </button>

//               {/* Results List */}
//               {matches.length > 0 && (
//                 <div className="mt-6 flex flex-col gap-2 animate-fade-in">
//                   <div className="flex justify-between items-center mb-1">
//                     <p className="text-xs font-bold text-gray-400 uppercase">
//                       Available Rides
//                     </p>
//                     <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
//                       {matches.length} found
//                     </span>
//                   </div>

//                   {matches.map((trip) => (
//                     <button
//                       key={trip.trip_id}
//                       onClick={() => connectToTrip(trip)}
//                       className="text-left bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md p-3 rounded-lg transition group"
//                     >
//                       <div className="flex justify-between items-center mb-1">
//                         <div className="font-bold text-gray-800 capitalize flex items-center gap-2">
//                           <Navigation size={14} className="text-blue-600" />{" "}
//                           {trip.vehicle_type}
//                         </div>
//                         <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
//                           Live
//                         </div>
//                       </div>
//                       <div className="text-xs text-gray-500 truncate">
//                         <span className="font-medium text-gray-700">
//                           {trip.start}
//                         </span>
//                         <span className="mx-1">→</span>
//                         <span className="font-medium text-gray-700">
//                           {trip.end}
//                         </span>
//                       </div>
//                     </button>
//                   ))}
//                 </div>
//               )}

//               {matches.length === 0 && !loading && myPos && (
//                 <div className="mt-6 text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
//                   <AlertCircle
//                     className="mx-auto text-gray-400 mb-2"
//                     size={24}
//                   />
//                   <p className="text-sm text-gray-600 font-medium">
//                     No vehicles found nearby.
//                   </p>
//                   <p className="text-xs text-gray-400 mt-1">
//                     Try moving closer to a main road.
//                   </p>
//                 </div>
//               )}
//             </>
//           ) : (
//             /* Active Tracking Panel */
//             <div className="animate-fade-in">
//               <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4 text-center">
//                 <h3 className="font-bold text-green-800 text-lg">
//                   Vehicle En Route
//                 </h3>
//                 <p className="text-green-600 text-xs">
//                   {activeTrip.start} → {activeTrip.end}
//                 </p>
//               </div>

//               <div className="grid grid-cols-2 gap-4 mb-6">
//                 <div className="bg-gray-50 p-3 rounded-lg border text-center">
//                   <p className="text-3xl font-bold text-gray-800">
//                     {eta ? Math.ceil(eta.duration / 60) : "--"}
//                   </p>
//                   <p className="text-xs text-gray-500 uppercase font-bold">
//                     Minutes
//                   </p>
//                 </div>
//                 <div className="bg-gray-50 p-3 rounded-lg border text-center">
//                   <p className="text-3xl font-bold text-gray-800">
//                     {eta ? (eta.distance / 1000).toFixed(1) : "--"}
//                   </p>
//                   <p className="text-xs text-gray-500 uppercase font-bold">
//                     Km Away
//                   </p>
//                 </div>
//               </div>

//               {!eta && (
//                 <p className="text-center text-xs text-blue-500 animate-pulse mb-4">
//                   Connecting to vehicle GPS...
//                 </p>
//               )}

//               <button
//                 onClick={leaveTrip}
//                 className="w-full border border-red-200 text-red-600 py-3 rounded-lg text-sm font-bold hover:bg-red-50 transition"
//               >
//                 Stop Tracking
//               </button>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* --- Map View --- */}
//       <MapContainer
//         center={[40.7128, -74.006]}
//         zoom={13}
//         style={{ height: "100%", width: "100%" }}
//         zoomControl={false}
//       >
//         <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

//         {/* Helper to set my position on map click */}
//         <LocationSelector onLocationSelected={setMyPos} />

//         {/* Auto Zoom when tracking */}
//         <AutoZoom routePath={vehiclePos ? [vehiclePos] : null} myPos={myPos} />

//         {/* My Location - Blue */}
//         {myPos && (
//           <CircleMarker
//             center={[myPos.lat, myPos.lon]}
//             radius={8}
//             pathOptions={{
//               color: "white",
//               fillColor: "#2563eb",
//               fillOpacity: 1,
//             }}
//           >
//             <Popup>You</Popup>
//           </CircleMarker>
//         )}

//         {/* Vehicle - Red with Pulsing Effect */}
//         {vehiclePos && (
//           <CircleMarker
//             center={vehiclePos}
//             radius={10}
//             pathOptions={{
//               color: "white",
//               fillColor: "#dc2626",
//               fillOpacity: 1,
//             }}
//           >
//             <Popup>
//               <div className="text-center">
//                 <strong>{activeTrip?.vehicle_type}</strong>
//                 <br />
//                 {(eta?.distance / 1000).toFixed(1)} km away
//               </div>
//             </Popup>
//           </CircleMarker>
//         )}
//       </MapContainer>
//     </div>
//   );
// };

// export default MapPassenger;

import React, { useState, useRef, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import LocationSearch from "./LocationSearch";
import axios from "axios";
import { Loader, MapPin, Navigation, AlertCircle } from "lucide-react";
import L from "leaflet";

// --- Helper: Auto Zoom to Match ---
const AutoZoom = ({ routePath, myPos }) => {
  const map = useMap();
  useEffect(() => {
    if (routePath && routePath.length > 0) {
      const bounds = L.latLngBounds(routePath);
      if (myPos) bounds.extend([myPos.lat, myPos.lon]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routePath, myPos, map]);
  return null;
};

// --- Component to handle map clicks ---
const LocationSelector = ({ onLocationSelected }) => {
  useMapEvents({
    click(e) {
      onLocationSelected({
        lat: e.latlng.lat,
        lon: e.latlng.lng,
        display_name: "Selected Location",
      });
    },
  });
  return null;
};

const MapPassenger = ({ onBack }) => {
  const [myPos, setMyPos] = useState(null);
  const [matches, setMatches] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);

  // Active Trip Data
  const [vehiclePos, setVehiclePos] = useState(null);
  const [eta, setEta] = useState(null);
  const [loading, setLoading] = useState(false);

  const ws = useRef(null);
  const heartbeatRef = useRef(null); // Ref to store the interval ID

  // 1. Search for Active Trips near me
  const handleCheckForVehicles = async () => {
    if (!myPos) return;
    setLoading(true);
    setMatches([]);

    try {
      const res = await axios.post(
        "http://localhost:8000/api/passenger/match/",
        {
          lat: myPos.lat,
          lon: myPos.lon,
        },
      );
      setMatches(res.data);
    } catch (err) {
      console.error(err);
      alert("Error scanning for vehicles. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Connect to a specific Trip
  const connectToTrip = (trip) => {
    setActiveTrip(trip);

    const wsUrl = `ws://localhost:8000/ws/trip/${trip.trip_id}/passenger/`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("Connected to Trip");
      // Send initial location immediately
      sendLocationUpdate();

      // START HEARTBEAT: Send location every 4 seconds to get updated ETA
      heartbeatRef.current = setInterval(sendLocationUpdate, 4000);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Update Vehicle Position on Map
      if (data.type === "vehicle_update") {
        setVehiclePos([data.lat, data.lon]);
      }

      // Update ETA Display
      if (data.type === "eta_update") {
        setEta(data.data); // { distance: meters, duration: seconds }
      }

      // Handle Driver End Trip
      if (data.type === "trip_ended") {
        alert("The driver has ended the trip.");
        leaveTrip();
      }
    };

    ws.current.onclose = () => {
      console.log("Connection closed");
    };
  };

  // Helper to send location
  const sendLocationUpdate = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && myPos) {
      ws.current.send(
        JSON.stringify({
          lat: myPos.lat,
          lon: myPos.lon,
        }),
      );
    }
  };

  const leaveTrip = () => {
    // Clear Interval
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    // Close Socket
    if (ws.current) ws.current.close();

    setActiveTrip(null);
    setVehiclePos(null);
    setEta(null);
  };

  // Cleanup on Unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (ws.current) ws.current.close();
    };
  }, []);

  return (
    <div className="h-full relative font-sans">
      {/* --- Sidebar / Overlay Panel --- */}
      <div className="absolute top-4 left-4 w-96 bg-white rounded-xl shadow-2xl z-[1000] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2">
            <MapPin size={18} className="text-green-400" /> Passenger View
          </h2>
          <button
            onClick={() => {
              leaveTrip();
              onBack();
            }}
            className="text-xs hover:text-gray-300"
          >
            Exit
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          {!activeTrip ? (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">
                  Set your location to find vehicles passing by on fixed routes.
                </p>
                <LocationSearch
                  placeholder="Search your location..."
                  onSelect={setMyPos}
                />

                {myPos && (
                  <div className="mt-2 text-xs bg-blue-50 text-blue-800 p-2 rounded border border-blue-100 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    Selected:{" "}
                    <strong>{myPos.display_name?.split(",")[0]}</strong>
                  </div>
                )}
              </div>

              <button
                onClick={handleCheckForVehicles}
                disabled={!myPos || loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <Loader className="animate-spin" size={18} />
                ) : (
                  "Scan for Vehicles (10m)"
                )}
              </button>

              {/* Results List */}
              {matches.length > 0 && (
                <div className="mt-6 flex flex-col gap-2 animate-fade-in">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-bold text-gray-400 uppercase">
                      Available Rides
                    </p>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      {matches.length} found
                    </span>
                  </div>

                  {matches.map((trip) => (
                    <button
                      key={trip.trip_id}
                      onClick={() => connectToTrip(trip)}
                      className="text-left bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md p-3 rounded-lg transition group"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-bold text-gray-800 capitalize flex items-center gap-2">
                          <Navigation size={14} className="text-blue-600" />{" "}
                          {trip.vehicle_type}
                        </div>
                        <div className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">
                          Live
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        <span className="font-medium text-gray-700">
                          {trip.start}
                        </span>
                        <span className="mx-1">→</span>
                        <span className="font-medium text-gray-700">
                          {trip.end}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {matches.length === 0 && !loading && myPos && (
                <div className="mt-6 text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <AlertCircle
                    className="mx-auto text-gray-400 mb-2"
                    size={24}
                  />
                  <p className="text-sm text-gray-600 font-medium">
                    No vehicles found nearby.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try moving closer to a main road.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Active Tracking Panel */
            <div className="animate-fade-in">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg mb-4 text-center">
                <h3 className="font-bold text-green-800 text-lg">
                  Vehicle En Route
                </h3>
                <p className="text-green-600 text-xs">
                  {activeTrip.start} → {activeTrip.end}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded-lg border text-center">
                  <p className="text-3xl font-bold text-gray-800">
                    {eta ? Math.ceil(eta.duration / 60) : "--"}
                  </p>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Minutes
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border text-center">
                  <p className="text-3xl font-bold text-gray-800">
                    {eta ? (eta.distance / 1000).toFixed(1) : "--"}
                  </p>
                  <p className="text-xs text-gray-500 uppercase font-bold">
                    Km Away
                  </p>
                </div>
              </div>

              {!eta && (
                <div className="flex items-center justify-center gap-2 text-xs text-blue-500 animate-pulse mb-4">
                  <Loader size={12} className="animate-spin" /> Calculating
                  ETA...
                </div>
              )}

              <button
                onClick={leaveTrip}
                className="w-full border border-red-200 text-red-600 py-3 rounded-lg text-sm font-bold hover:bg-red-50 transition"
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
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Helper to set my position on map click (Only active if not tracking) */}
        {!activeTrip && <LocationSelector onLocationSelected={setMyPos} />}

        {/* Auto Zoom when tracking */}
        <AutoZoom routePath={vehiclePos ? [vehiclePos] : null} myPos={myPos} />

        {/* My Location - Blue */}
        {myPos && (
          <CircleMarker
            center={[myPos.lat, myPos.lon]}
            radius={8}
            pathOptions={{
              color: "white",
              fillColor: "#2563eb",
              fillOpacity: 1,
            }}
          >
            <Popup>You</Popup>
          </CircleMarker>
        )}

        {/* Vehicle - Red with Pulsing Effect */}
        {vehiclePos && (
          <CircleMarker
            center={vehiclePos}
            radius={10}
            pathOptions={{
              color: "white",
              fillColor: "#dc2626",
              fillOpacity: 1,
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
  );
};

export default MapPassenger;
