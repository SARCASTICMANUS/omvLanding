// import React, { useState, useEffect, useMemo, useRef } from "react";
// import {
//   MapContainer,
//   TileLayer,
//   Polyline,
//   Marker,
//   useMapEvents,
// } from "react-leaflet";
// import axios from "axios";
// import { Trash2, Save, MapPin, Navigation } from "lucide-react";
// import LocationSearch from "./LocationSearch"; // Reuse existing component
// import L from "leaflet";

// // --- Draggable Marker Component ---
// function DraggableMarker({ position, color, onDragEnd }) {
//   const markerRef = useRef(null);

//   const icon = useMemo(
//     () =>
//       new L.DivIcon({
//         className: "bg-transparent",
//         html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
//         iconSize: [16, 16],
//         iconAnchor: [8, 8],
//       }),
//     [color],
//   );

//   const eventHandlers = useMemo(
//     () => ({
//       dragend() {
//         const marker = markerRef.current;
//         if (marker != null) {
//           onDragEnd(marker.getLatLng());
//         }
//       },
//     }),
//     [onDragEnd],
//   );

//   return (
//     <Marker
//       draggable={true}
//       eventHandlers={eventHandlers}
//       position={position}
//       ref={markerRef}
//       icon={icon}
//     />
//   );
// }

// // --- Map Click Handler ---
// const MapClicker = ({ onMapClick }) => {
//   useMapEvents({
//     click(e) {
//       onMapClick(e.latlng);
//     },
//   });
//   return null;
// };

// // --- Main Component ---
// const AdminRouteManager = ({ onBack }) => {
//   const [routes, setRoutes] = useState([]);
//   const [selectedSavedRoute, setSelectedSavedRoute] = useState(null);

//   // Route Creation State
//   const [newRoutePoints, setNewRoutePoints] = useState({
//     start: null,
//     end: null,
//   });
//   const [names, setNames] = useState({ start: "", end: "" });
//   const [loading, setLoading] = useState(false);

//   // Load existing routes
//   useEffect(() => {
//     fetchRoutes();
//   }, []);

//   const fetchRoutes = async () => {
//     try {
//       const res = await axios.get("http://localhost:8000/api/admin/routes/");
//       setRoutes(res.data);
//     } catch (err) {
//       console.error("Failed to fetch routes", err);
//     }
//   };

//   // Handle Search Selection
//   const handleSearchSelect = (type, item) => {
//     const latlng = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
//     if (type === "start") {
//       setNewRoutePoints((prev) => ({ ...prev, start: latlng }));
//       setNames((prev) => ({ ...prev, start: item.display_name.split(",")[0] }));
//     } else {
//       setNewRoutePoints((prev) => ({ ...prev, end: latlng }));
//       setNames((prev) => ({ ...prev, end: item.display_name.split(",")[0] }));
//     }
//     // Deselect saved route when creating new one
//     setSelectedSavedRoute(null);
//   };

//   // Handle Map Clicks
//   const handleMapClick = (latlng) => {
//     setSelectedSavedRoute(null); // Clear viewing mode
//     if (!newRoutePoints.start) {
//       setNewRoutePoints((prev) => ({ ...prev, start: latlng }));
//       setNames((prev) => ({ ...prev, start: "Map Point A" }));
//     } else if (!newRoutePoints.end) {
//       setNewRoutePoints((prev) => ({ ...prev, end: latlng }));
//       setNames((prev) => ({ ...prev, end: "Map Point B" }));
//     }
//   };

//   // Handle Dragging Pins
//   const handleDrag = (type, newLatLng) => {
//     setNewRoutePoints((prev) => ({ ...prev, [type]: newLatLng }));
//   };

//   const saveRoute = async () => {
//     if (!newRoutePoints.start || !newRoutePoints.end) return;
//     setLoading(true);
//     try {
//       await axios.post("http://localhost:8000/api/admin/routes/", {
//         start: { lat: newRoutePoints.start.lat, lon: newRoutePoints.start.lng },
//         end: { lat: newRoutePoints.end.lat, lon: newRoutePoints.end.lng },
//         start_name: names.start,
//         end_name: names.end,
//       });
//       fetchRoutes();
//       // Reset form
//       setNewRoutePoints({ start: null, end: null });
//       setNames({ start: "", end: "" });
//     } catch (err) {
//       alert("Failed to save route. Ensure OSRM is running.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const deleteRoute = async (e, id) => {
//     e.stopPropagation(); // Prevent clicking the row from selecting it
//     if (!confirm("Delete this route permanently?")) return;
//     await axios.delete(`http://localhost:8000/api/admin/routes/?id=${id}`);
//     fetchRoutes();
//     if (selectedSavedRoute?.id === id) setSelectedSavedRoute(null);
//   };

//   return (
//     <div className="flex h-full font-sans">
//       {/* Sidebar List */}
//       <div className="w-96 bg-white border-r shadow-xl z-[500] flex flex-col h-full overflow-hidden">
//         {/* Header */}
//         <div className="p-4 bg-gray-900 text-white flex justify-between items-center shadow-md">
//           <h2 className="font-bold text-lg flex items-center gap-2">
//             <Navigation size={18} /> Route Admin
//           </h2>
//           <button
//             onClick={onBack}
//             className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition"
//           >
//             Exit
//           </button>
//         </div>

//         {/* Creation Form */}
//         <div className="p-4 bg-gray-50 border-b">
//           <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
//             <MapPin size={14} /> Create New Route
//           </h3>

//           <div className="space-y-3 relative">
//             {/* Start Search */}
//             <div className="z-[60]">
//               <label className="text-xs font-bold text-green-600 ml-1">
//                 Start Point (A)
//               </label>
//               <div className="flex gap-2">
//                 <LocationSearch
//                   placeholder="Search Start..."
//                   onSelect={(item) => handleSearchSelect("start", item)}
//                 />
//               </div>
//               {/* Fallback manual name edit if search isn't used */}
//               <input
//                 value={names.start}
//                 onChange={(e) => setNames({ ...names, start: e.target.value })}
//                 placeholder="or name manually..."
//                 className="w-full text-xs mt-1 border-none bg-transparent focus:ring-0 text-gray-500"
//               />
//             </div>

//             {/* End Search */}
//             <div className="z-[50]">
//               <label className="text-xs font-bold text-red-600 ml-1">
//                 End Point (B)
//               </label>
//               <div className="flex gap-2">
//                 <LocationSearch
//                   placeholder="Search End..."
//                   onSelect={(item) => handleSearchSelect("end", item)}
//                 />
//               </div>
//               <input
//                 value={names.end}
//                 onChange={(e) => setNames({ ...names, end: e.target.value })}
//                 placeholder="or name manually..."
//                 className="w-full text-xs mt-1 border-none bg-transparent focus:ring-0 text-gray-500"
//               />
//             </div>

//             <button
//               onClick={saveRoute}
//               disabled={!newRoutePoints.end || loading}
//               className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 flex justify-center gap-2 items-center transition shadow-sm"
//             >
//               <Save size={18} /> {loading ? "Calculating..." : "Save Route"}
//             </button>

//             {(newRoutePoints.start || newRoutePoints.end) && (
//               <button
//                 onClick={() => {
//                   setNewRoutePoints({ start: null, end: null });
//                   setNames({ start: "", end: "" });
//                 }}
//                 className="text-xs text-red-500 w-full text-center hover:underline"
//               >
//                 Clear Map Points
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Route List */}
//         <div className="flex-1 overflow-y-auto bg-white">
//           <div className="p-4 pb-2 text-xs font-bold text-gray-400 uppercase border-b bg-white sticky top-0">
//             Saved Routes ({routes.length})
//           </div>
//           {routes.length === 0 && (
//             <div className="p-8 text-center text-gray-400 text-sm">
//               No routes saved yet.
//             </div>
//           )}
//           {routes.map((r) => (
//             <div
//               key={r.id}
//               onClick={() => {
//                 setSelectedSavedRoute(r);
//                 setNewRoutePoints({ start: null, end: null });
//               }}
//               className={`p-4 border-b cursor-pointer transition flex justify-between items-center group
//                     ${selectedSavedRoute?.id === r.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-gray-50 border-l-4 border-l-transparent"}
//                 `}
//             >
//               <div>
//                 <div className="font-bold text-gray-800 text-sm">
//                   {r.start_name}
//                 </div>
//                 <div className="text-gray-400 text-xs my-0.5">to</div>
//                 <div className="font-bold text-gray-800 text-sm">
//                   {r.end_name}
//                 </div>
//                 <div className="text-xs text-blue-500 mt-1 font-mono">
//                   {r.distance_km} km
//                 </div>
//               </div>
//               <button
//                 onClick={(e) => deleteRoute(e, r.id)}
//                 className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition"
//               >
//                 <Trash2 size={16} />
//               </button>
//             </div>
//           ))}
//         </div>
//       </div>

//       {/* Map Area */}
//       <div className="flex-1 relative bg-gray-200">
//         <MapContainer
//           center={[40.7128, -74.006]}
//           zoom={12}
//           style={{ height: "100%", width: "100%" }}
//         >
//           <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
//           <MapClicker onMapClick={handleMapClick} />

//           {/* --- MODE 1: Creating New Route (Draggable Pins) --- */}
//           {!selectedSavedRoute && (
//             <>
//               {newRoutePoints.start && (
//                 <DraggableMarker
//                   position={newRoutePoints.start}
//                   color="#16a34a" // Green
//                   onDragEnd={(pos) => handleDrag("start", pos)}
//                 />
//               )}
//               {newRoutePoints.end && (
//                 <DraggableMarker
//                   position={newRoutePoints.end}
//                   color="#dc2626" // Red
//                   onDragEnd={(pos) => handleDrag("end", pos)}
//                 />
//               )}

//               {/* Visual Line connecting points (straight line preview until saved) */}
//               {newRoutePoints.start && newRoutePoints.end && (
//                 <Polyline
//                   positions={[newRoutePoints.start, newRoutePoints.end]}
//                   pathOptions={{
//                     color: "gray",
//                     dashArray: "5, 10",
//                     weight: 2,
//                     opacity: 0.5,
//                   }}
//                 />
//               )}
//             </>
//           )}

//           {/* --- MODE 2: Viewing Saved Route --- */}
//           {selectedSavedRoute && (
//             <>
//               <Polyline
//                 positions={selectedSavedRoute.path}
//                 pathOptions={{ color: "#2563eb", weight: 6, opacity: 0.8 }}
//               />
//               {/* Start Marker */}
//               <Marker
//                 position={selectedSavedRoute.path[0]}
//                 icon={
//                   new L.DivIcon({
//                     className: "bg-transparent",
//                     html: `<div style="background-color: #16a34a; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
//                   })
//                 }
//               />
//               {/* End Marker */}
//               <Marker
//                 position={
//                   selectedSavedRoute.path[selectedSavedRoute.path.length - 1]
//                 }
//                 icon={
//                   new L.DivIcon({
//                     className: "bg-transparent",
//                     html: `<div style="background-color: #dc2626; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
//                   })
//                 }
//               />
//             </>
//           )}
//         </MapContainer>

//         {/* Helper Toast */}
//         {!selectedSavedRoute && !newRoutePoints.start && (
//           <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg z-[400] text-xs font-bold text-gray-600 border border-white/50">
//             Click map or use search to set Start Point
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default AdminRouteManager;
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import axios from "axios";
import { Trash2, Save, MapPin, Navigation } from "lucide-react";
import LocationSearch from "./LocationSearch";
import L from "leaflet";

// --- Component to Handle Auto-Zooming ---
const AutoZoom = ({ selectedRoute, points }) => {
  const map = useMap();

  useEffect(() => {
    // 1. If viewing a saved route, fit to its path
    if (selectedRoute && selectedRoute.path.length > 0) {
      const bounds = L.latLngBounds(selectedRoute.path);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    // 2. If creating new route and both points exist, fit bounds to include both
    else if (points.start && points.end) {
      const bounds = L.latLngBounds([points.start, points.end]);
      map.fitBounds(bounds, { padding: [100, 100] });
    }
    // 3. If only start point exists (e.g. just searched), fly to it
    else if (points.start) {
      map.flyTo(points.start, 14, { duration: 1.5 });
    }
  }, [selectedRoute, points, map]);

  return null;
};

// --- Draggable Marker Component ---
function DraggableMarker({ position, color, onDragEnd }) {
  const markerRef = useRef(null);

  const icon = useMemo(
    () =>
      new L.DivIcon({
        className: "bg-transparent",
        html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    [color],
  );

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          onDragEnd(marker.getLatLng());
        }
      },
    }),
    [onDragEnd],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={icon}
    />
  );
}

// --- Map Click Handler ---
const MapClicker = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
};

// --- Main Component ---
const AdminRouteManager = ({ onBack }) => {
  const [routes, setRoutes] = useState([]);
  const [selectedSavedRoute, setSelectedSavedRoute] = useState(null);

  // Route Creation State
  const [newRoutePoints, setNewRoutePoints] = useState({
    start: null,
    end: null,
  });
  const [names, setNames] = useState({ start: "", end: "" });
  const [loading, setLoading] = useState(false);

  // Load existing routes
  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await axios.get("http://localhost:8000/api/admin/routes/");
      setRoutes(res.data);
    } catch (err) {
      console.error("Failed to fetch routes", err);
    }
  };

  // Handle Search Selection
  const handleSearchSelect = (type, item) => {
    const latlng = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
    if (type === "start") {
      setNewRoutePoints((prev) => ({ ...prev, start: latlng }));
      setNames((prev) => ({ ...prev, start: item.display_name.split(",")[0] }));
    } else {
      setNewRoutePoints((prev) => ({ ...prev, end: latlng }));
      setNames((prev) => ({ ...prev, end: item.display_name.split(",")[0] }));
    }
    // Deselect saved route when creating new one
    setSelectedSavedRoute(null);
  };

  // Handle Map Clicks
  const handleMapClick = (latlng) => {
    setSelectedSavedRoute(null); // Clear viewing mode
    if (!newRoutePoints.start) {
      setNewRoutePoints((prev) => ({ ...prev, start: latlng }));
      setNames((prev) => ({ ...prev, start: "Map Point A" }));
    } else if (!newRoutePoints.end) {
      setNewRoutePoints((prev) => ({ ...prev, end: latlng }));
      setNames((prev) => ({ ...prev, end: "Map Point B" }));
    }
  };

  // Handle Dragging Pins
  const handleDrag = (type, newLatLng) => {
    setNewRoutePoints((prev) => ({ ...prev, [type]: newLatLng }));
  };

  const saveRoute = async () => {
    if (!newRoutePoints.start || !newRoutePoints.end) return;
    setLoading(true);
    try {
      await axios.post("http://localhost:8000/api/admin/routes/", {
        start: { lat: newRoutePoints.start.lat, lon: newRoutePoints.start.lng },
        end: { lat: newRoutePoints.end.lat, lon: newRoutePoints.end.lng },
        start_name: names.start,
        end_name: names.end,
      });
      fetchRoutes();
      // Reset form
      setNewRoutePoints({ start: null, end: null });
      setNames({ start: "", end: "" });
    } catch (err) {
      alert("Failed to save route. Ensure OSRM is running.");
    } finally {
      setLoading(false);
    }
  };

  const deleteRoute = async (e, id) => {
    e.stopPropagation(); // Prevent clicking the row from selecting it
    if (!confirm("Delete this route permanently?")) return;
    await axios.delete(`http://localhost:8000/api/admin/routes/?id=${id}`);
    fetchRoutes();
    if (selectedSavedRoute?.id === id) setSelectedSavedRoute(null);
  };

  return (
    <div className="flex h-full font-sans">
      {/* Sidebar List */}
      <div className="w-96 bg-white border-r shadow-xl z-[500] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center shadow-md">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Navigation size={18} /> Route Admin
          </h2>
          <button
            onClick={onBack}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded transition"
          >
            Exit
          </button>
        </div>

        {/* Creation Form */}
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
            <MapPin size={14} /> Create New Route
          </h3>

          <div className="space-y-3 relative">
            {/* Start Search */}
            <div className="z-[60]">
              <label className="text-xs font-bold text-green-600 ml-1">
                Start Point (A)
              </label>
              <div className="flex gap-2">
                <LocationSearch
                  placeholder="Search Start..."
                  onSelect={(item) => handleSearchSelect("start", item)}
                />
              </div>
              {/* Fallback manual name edit if search isn't used */}
              <input
                value={names.start}
                onChange={(e) => setNames({ ...names, start: e.target.value })}
                placeholder="or name manually..."
                className="w-full text-xs mt-1 border-none bg-transparent focus:ring-0 text-gray-500"
              />
            </div>

            {/* End Search */}
            <div className="z-[50]">
              <label className="text-xs font-bold text-red-600 ml-1">
                End Point (B)
              </label>
              <div className="flex gap-2">
                <LocationSearch
                  placeholder="Search End..."
                  onSelect={(item) => handleSearchSelect("end", item)}
                />
              </div>
              <input
                value={names.end}
                onChange={(e) => setNames({ ...names, end: e.target.value })}
                placeholder="or name manually..."
                className="w-full text-xs mt-1 border-none bg-transparent focus:ring-0 text-gray-500"
              />
            </div>

            <button
              onClick={saveRoute}
              disabled={!newRoutePoints.end || loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 flex justify-center gap-2 items-center transition shadow-sm"
            >
              <Save size={18} /> {loading ? "Calculating..." : "Save Route"}
            </button>

            {(newRoutePoints.start || newRoutePoints.end) && (
              <button
                onClick={() => {
                  setNewRoutePoints({ start: null, end: null });
                  setNames({ start: "", end: "" });
                }}
                className="text-xs text-red-500 w-full text-center hover:underline"
              >
                Clear Map Points
              </button>
            )}
          </div>
        </div>

        {/* Route List */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="p-4 pb-2 text-xs font-bold text-gray-400 uppercase border-b bg-white sticky top-0">
            Saved Routes ({routes.length})
          </div>
          {routes.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No routes saved yet.
            </div>
          )}
          {routes.map((r) => (
            <div
              key={r.id}
              onClick={() => {
                setSelectedSavedRoute(r);
                setNewRoutePoints({ start: null, end: null });
              }}
              className={`p-4 border-b cursor-pointer transition flex justify-between items-center group
                    ${selectedSavedRoute?.id === r.id ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-gray-50 border-l-4 border-l-transparent"}
                `}
            >
              <div>
                <div className="font-bold text-gray-800 text-sm">
                  {r.start_name}
                </div>
                <div className="text-gray-400 text-xs my-0.5">to</div>
                <div className="font-bold text-gray-800 text-sm">
                  {r.end_name}
                </div>
                <div className="text-xs text-blue-500 mt-1 font-mono">
                  {r.distance_km} km
                </div>
              </div>
              <button
                onClick={(e) => deleteRoute(e, r.id)}
                className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-gray-200">
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Auto Zoom Controller */}
          <AutoZoom
            selectedRoute={selectedSavedRoute}
            points={newRoutePoints}
          />

          <MapClicker onMapClick={handleMapClick} />

          {/* --- MODE 1: Creating New Route (Draggable Pins) --- */}
          {!selectedSavedRoute && (
            <>
              {newRoutePoints.start && (
                <DraggableMarker
                  position={newRoutePoints.start}
                  color="#16a34a" // Green
                  onDragEnd={(pos) => handleDrag("start", pos)}
                />
              )}
              {newRoutePoints.end && (
                <DraggableMarker
                  position={newRoutePoints.end}
                  color="#dc2626" // Red
                  onDragEnd={(pos) => handleDrag("end", pos)}
                />
              )}

              {/* Visual Line connecting points (straight line preview until saved) */}
              {newRoutePoints.start && newRoutePoints.end && (
                <Polyline
                  positions={[newRoutePoints.start, newRoutePoints.end]}
                  pathOptions={{
                    color: "gray",
                    dashArray: "5, 10",
                    weight: 2,
                    opacity: 0.5,
                  }}
                />
              )}
            </>
          )}

          {/* --- MODE 2: Viewing Saved Route --- */}
          {selectedSavedRoute && (
            <>
              <Polyline
                positions={selectedSavedRoute.path}
                pathOptions={{ color: "#2563eb", weight: 6, opacity: 0.8 }}
              />
              {/* Start Marker */}
              <Marker
                position={selectedSavedRoute.path[0]}
                icon={
                  new L.DivIcon({
                    className: "bg-transparent",
                    html: `<div style="background-color: #16a34a; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
                  })
                }
              />
              {/* End Marker */}
              <Marker
                position={
                  selectedSavedRoute.path[selectedSavedRoute.path.length - 1]
                }
                icon={
                  new L.DivIcon({
                    className: "bg-transparent",
                    html: `<div style="background-color: #dc2626; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
                  })
                }
              />
            </>
          )}
        </MapContainer>

        {/* Helper Toast */}
        {!selectedSavedRoute && !newRoutePoints.start && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg z-[400] text-xs font-bold text-gray-600 border border-white/50">
            Search or Click map to set Start Point (A)
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRouteManager;
