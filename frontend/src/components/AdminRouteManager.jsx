import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMapEvents,
  useMap,
  Tooltip,
} from "react-leaflet";
import api from "../utils/api";
import {
  Trash2,
  Save,
  MapPin,
  Navigation,
  XCircle,
  Plus,
  ArrowUp,
  ArrowDown,
  School,
  Bus,
} from "lucide-react";
import LocationSearch from "./Shared/LocationSearch";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- Helpers ---
const AutoZoom = ({ selectedRoute, points, stops }) => {
  const map = useMap();
  useEffect(() => {
    if (selectedRoute && selectedRoute.path_coords) {
      const bounds = L.latLngBounds(selectedRoute.path_coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (points.start && points.end) {
      const allPoints = [];
      
      const format = (p) => {
        if (!p) return null;
        const lat = p.lat;
        const lng = p.lng || p.lon;
        if (lat !== undefined && lng !== undefined) return [lat, lng];
        return null;
      };

      const start = format(points.start);
      const end = format(points.end);
      
      if (start) allPoints.push(start);
      if (end) allPoints.push(end);
      
      stops.forEach(s => {
        const p = format(s);
        if (p) allPoints.push(p);
      });

      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [100, 100] });
      }
    }
  }, [selectedRoute, points, stops, map]);
  return null;
};

const StopIcon = (order) =>
  new L.DivIcon({
    className: "bg-transparent",
    html: `<div class="flex items-center justify-center bg-indigo-600 text-white w-6 h-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold">${order + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

// --- 3. Helper: Map Click Handler ---
const MapClicker = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
};

// --- Main Component ---
const AdminRouteManager = ({ onBack, preSelectedCity }) => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(preSelectedCity || "");
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // Design State
  const [newPoints, setNewPoints] = useState({ start: null, end: null });
  const [stops, setStops] = useState([]); // [{lat, lon, name}]
  const [names, setNames] = useState({ route: "", start: "", end: "" });
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [loading, setLoading] = useState(false);

  // New: Alternative Routing State
  const [previews, setPreviews] = useState([]); // [{path, distance, duration}]
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    if (selectedCity) fetchRoutes();
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const res = await api.get("/api/cities/");
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCities(data);
      if (!selectedCity && data.length > 0) setSelectedCity(data[0].id);
    } catch (e) {
      console.error("Failed to load cities", e);
    }
  };

  const fetchRoutes = async () => {
    try {
      const res = await api.get(
        `/api/admin/routes/?city=${selectedCity}`,
      );
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setRoutes(data);
    } catch (e) {
      console.error("Failed to load routes", e);
    }
  };

  const handleMapClick = (latlng) => {
    setSelectedRoute(null);
    if (isAddingStop) {
      const newStop = { lat: latlng.lat, lng: latlng.lng, name: `Stop ${stops.length + 1}` };
      setStops([...stops, newStop]);
      setIsAddingStop(false);
      // Automatically reverse geocode the stop
      reverseGeocode(latlng, (name) => {
        setStops(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(s => s.lat === latlng.lat && s.lng === latlng.lng);
          if (idx !== -1) updated[idx].name = name;
          return updated;
        });
      });
    } else if (!newPoints.start) {
      setNewPoints({ ...newPoints, start: { lat: latlng.lat, lng: latlng.lng } });
      reverseGeocode(latlng, (name) => setNames(prev => ({ ...prev, start: name })));
    } else if (!newPoints.end) {
      setNewPoints({ ...newPoints, end: { lat: latlng.lat, lng: latlng.lng } });
      reverseGeocode(latlng, (name) => setNames(prev => ({ ...prev, end: name })));
    }
  };

  const reverseGeocode = async (latlng, callback) => {
    try {
      const res = await api.get(`/api/reverse-search/?lat=${latlng.lat}&lon=${latlng.lng || latlng.lon}`);
      if (res.data && res.data.display_name) {
        callback(res.data.display_name);
      }
    } catch (e) {
      console.error("Reverse geocode failed", e);
    }
  };

  const handleDrag = (type, latlng, index = null) => {
    const coords = { lat: latlng.lat, lng: latlng.lng };
    if (type === "stop") {
      const newStops = [...stops];
      newStops[index] = {
        ...newStops[index],
        ...coords
      };
      setStops(newStops);
      reverseGeocode(latlng, (name) => {
        setStops(prev => {
          const updated = [...prev];
          updated[index].name = name;
          return updated;
        });
      });
    } else {
      setNewPoints({ ...newPoints, [type]: coords });
      reverseGeocode(latlng, (name) => setNames(prev => ({ ...prev, [type]: name })));
    }
  };

  // New: Fetch Route Previews
  useEffect(() => {
    if (newPoints.start && newPoints.end) {
      fetchPreviews();
    } else {
      setPreviews([]);
    }
  }, [newPoints, stops]);

  const fetchPreviews = async () => {
    try {
      const res = await api.post("/api/admin/routes/preview/", {
        start: { lat: newPoints.start.lat, lon: newPoints.start.lng || newPoints.start.lon },
        end: { lat: newPoints.end.lat, lon: newPoints.end.lng || newPoints.end.lon },
        stops: stops.map((s, i) => ({ 
          lat: s.lat, 
          lon: s.lng || s.lon, 
          name: s.name, 
          order: i 
        })),
      });
      setPreviews(res.data);
      setSelectedIndex(0); // Default to first (usually shortest/best)
    } catch (e) {
      console.error("Preview fetch failed", e);
    }
  };

  const reorderStop = (index, dir) => {
    const newStops = [...stops];
    const target = index + dir;
    if (target < 0 || target >= stops.length) return;
    [newStops[index], newStops[target]] = [newStops[target], newStops[index]];
    setStops(newStops);
  };

  const saveRoute = async () => {
    if (!newPoints.start || !newPoints.end || !selectedCity) return;
    setLoading(true);

    const activePreview = previews[selectedIndex];

    try {
      await api.post("/api/admin/routes/", {
        city: selectedCity,
        name: names.route || "New Route",
        start_name: names.start,
        end_name: names.end,
        start: { lat: newPoints.start.lat, lon: newPoints.start.lng || newPoints.start.lon },
        end: { lat: newPoints.end.lat, lon: newPoints.end.lng || newPoints.end.lon },
        stops: stops.map((s, i) => ({ 
          lat: s.lat, 
          lon: s.lng || s.lon, 
          name: s.name, 
          order: i 
        })),
        // Pass the selected alternative's path
        path: activePreview?.path,
        total_distance: activePreview?.distance,
      });
      fetchRoutes();
      resetForm();
    } catch (e) {
      alert("Failed to save route. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewPoints({ start: null, end: null });
    setStops([]);
    setNames({ route: "", start: "", end: "" });
    setSelectedRoute(null);
    setPreviews([]);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* --- Sidebar --- */}
      <div className="w-[400px] bg-white border-r border-slate-200 shadow-xl z-[1000] flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex flex-col gap-4 shadow-lg">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-xl flex items-center gap-3 tracking-tight">
              <School className="text-indigo-400" size={24} /> City
              Transit
            </h2>
            <button
              onClick={onBack}
              className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition tracking-widest"
            >
              Exit Admin
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Selected City
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-slate-800 border-none text-white text-sm rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="">Select City...</option>
              {cities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">
            {/* Route Naming */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Route Details
              </label>
              <input
                value={names.route}
                onChange={(e) => setNames({ ...names, route: e.target.value })}
                placeholder="Route Name (e.g. Campus Express)"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium"
              />
            </div>

            {/* Path Selection */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-16 bg-indigo-200 rounded-full flex flex-col justify-between items-center py-1">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></div>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Origin
                    </span>
                    <LocationSearch
                      placeholder="Search Start Point"
                      onSelect={(item) => {
                        setNewPoints({ ...newPoints, start: { lat: item.lat, lng: item.lon } });
                        setNames({ ...names, start: item.display_name });
                      }}
                      initialValue={names.start}
                    />
                  </div>
                  <div className="h-px bg-slate-200"></div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Destination
                    </span>
                    <LocationSearch
                      placeholder="Search End Point"
                      onSelect={(item) => {
                        setNewPoints({ ...newPoints, end: { lat: item.lat, lng: item.lon } });
                        setNames({ ...names, end: item.display_name });
                      }}
                      initialValue={names.end}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Stop Management */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Transit Stops ({stops.length})
                </label>
                <button
                  onClick={() => setIsAddingStop(!isAddingStop)}
                  className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full transition ${isAddingStop ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"}`}
                >
                  {isAddingStop ? <XCircle size={14} /> : <Plus size={14} />}
                  {isAddingStop ? "Cancel" : "Add Stop"}
                </button>
              </div>

              {isAddingStop && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-700 flex items-center gap-2 animate-pulse">
                  <MapPin size={14} /> Click any point on the map to mark a new
                  stop.
                </div>
              )}

              <div className="space-y-2">
                {stops.map((stop, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 group hover:shadow-md transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <LocationSearch
                        placeholder="Search Stop Name"
                        onSelect={(item) => {
                          const newStops = [...stops];
                          newStops[i] = {
                            ...newStops[i],
                            name: item.display_name,
                            lat: item.lat,
                            lon: item.lon,
                          };
                          setStops(newStops);
                        }}
                        initialValue={stop.name}
                      />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => reorderStop(i, -1)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => reorderStop(i, 1)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-400"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setStops(stops.filter((_, idx) => idx !== i))
                        }
                        className="p-1.5 hover:bg-red-50 rounded text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveRoute}
              disabled={!newPoints.end || loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl hover:shadow-indigo-500/30 flex justify-center items-center gap-3 disabled:bg-slate-200 disabled:shadow-none disabled:text-slate-400"
            >
              <Save size={18} />{" "}
              {loading ? "Scaling Transit Path..." : "Save Route Package"}
            </button>
          </div>
        </div>

        {/* Existing Routes */}
        <div className="h-48 border-t border-slate-100 p-4 bg-slate-50 flex flex-col gap-3">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
            Current Library
          </h3>
          <div className="overflow-x-auto flex gap-3 pb-2 custom-scrollbar-h">
            {routes.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedRoute(r)}
                className={`flex-shrink-0 w-40 p-3 rounded-xl cursor-pointer transition border ${selectedRoute?.id === r.id ? "bg-white border-indigo-300 shadow-md ring-1 ring-indigo-200" : "bg-white/60 border-transparent hover:bg-white hover:border-slate-200"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Bus size={12} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {r.name}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  {r.start_name} → {r.end_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- Map Area --- */}
      <div className="flex-1 relative">
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <AutoZoom
            selectedRoute={selectedRoute}
            points={newPoints}
            stops={stops}
          />
          <MapClicker onMapClick={handleMapClick} />

          {/* New Route Preview */}
          {!selectedRoute && (
            <>
              {newPoints.start && (
                <Marker
                  position={[newPoints.start.lat, newPoints.start.lng || newPoints.start.lon]}
                  icon={
                    new L.DivIcon({
                      className: "bg-transparent",
                      html: `<div class="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg"></div>`,
                    })
                  }
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => handleDrag("start", e.target.getLatLng()),
                  }}
                />
              )}
              {newPoints.end && (
                <Marker
                  position={[newPoints.end.lat, newPoints.end.lng || newPoints.end.lon]}
                  icon={
                    new L.DivIcon({
                      className: "bg-transparent",
                      html: `<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg"></div>`,
                    })
                  }
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => handleDrag("end", e.target.getLatLng()),
                  }}
                />
              )}

              {/* Alternative Preview Options */}
              {previews.map((p, idx) => (
                <Polyline
                  key={`preview-${idx}`}
                  positions={p.path}
                  eventHandlers={{
                    click: () => setSelectedIndex(idx),
                  }}
                  pathOptions={{
                    color: selectedIndex === idx ? "#4f46e5" : "#94a3b8",
                    weight: selectedIndex === idx ? 7 : 4,
                    opacity: selectedIndex === idx ? 0.9 : 0.4,
                  }}
                >
                  <Tooltip sticky>
                    Route Option {idx + 1} ({(p.distance / 1000).toFixed(1)} km)
                  </Tooltip>
                </Polyline>
              ))}

              {!previews.length && newPoints.start && newPoints.end && (
                <Polyline
                  positions={[
                    [newPoints.start.lat, newPoints.start.lng || newPoints.start.lon],
                    [newPoints.end.lat, newPoints.end.lng || newPoints.end.lon]
                  ]}
                  pathOptions={{
                    color: "gray",
                    dashArray: "10, 10",
                    weight: 2,
                    opacity: 0.5,
                  }}
                />
              )}

              {stops.map((s, i) => (
                <Marker
                  key={i}
                  position={[s.lat, s.lng || s.lon]}
                  icon={StopIcon(i)}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => handleDrag("stop", e.target.getLatLng(), i),
                  }}
                >
                  <Tooltip
                    permanent
                    direction="top"
                    offset={[0, -10]}
                    className="bg-white border-none shadow-lg text-[10px] font-bold rounded-full px-3 py-1 text-slate-700"
                  >
                    {s.name}
                  </Tooltip>
                </Marker>
              ))}
            </>
          )}

          {/* Saved Route View */}
          {selectedRoute && (
            <>
              <Polyline
                positions={selectedRoute.path_coords}
                pathOptions={{ color: "#4f46e5", weight: 6, opacity: 0.8 }}
              />
              {selectedRoute.stops.map((s, i) => (
                <Marker key={i} position={[s.lat, s.lng || s.lon]} icon={StopIcon(i)}>
                  <Tooltip direction="top" offset={[0, -10]}>
                    {s.name}
                  </Tooltip>
                </Marker>
              ))}
            </>
          )}
        </MapContainer>

        {/* Floating Help */}
        <div className="absolute top-6 right-6 flex flex-col items-end gap-3 z-[1000]">
          <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/50 space-y-2">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">
              Map Instructions
            </h4>
            <ul className="text-[11px] text-slate-600 space-y-1 font-medium">
              <li className="flex items-center gap-2">
                🖱️ Click 1: Origin Point
              </li>
              <li className="flex items-center gap-2">
                🖱️ Click 2: Destination Point
              </li>
              <li className="flex items-center gap-2">
                📍 Click "Add Stop" then map to mark stops
              </li>
              <li className="flex items-center gap-2">
                🎯 Drag markers to refine locations
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRouteManager;
