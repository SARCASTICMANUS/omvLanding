import React, { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../lib/api";
import {
  Trash2,
  Save,
  MapPin,
  Navigation,
  XCircle,
  Plus,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  School,
  Bus,
  Upload,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import LocationSearch from "./LocationSearch";

const normalizeImportKey = (key) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeImportRow = (row) =>
  Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[normalizeImportKey(key)] = value;
    return acc;
  }, {});

const firstValue = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePoint = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const first = toFiniteNumber(value[0]);
    const second = toFiniteNumber(value[1]);
    if (first === null || second === null) return null;
    return Math.abs(first) > 35 ? { lat: second, lon: first } : { lat: first, lon: second };
  }

  if (value && typeof value === "object") {
    const normalized = normalizeImportRow(value);
    const lat = toFiniteNumber(firstValue(normalized, ["lat", "latitude"]));
    const lon = toFiniteNumber(firstValue(normalized, ["lon", "lng", "longitude"]));
    if (lat !== null && lon !== null) return { lat, lon };
  }

  return null;
};

const pointFromRow = (row, prefix) => {
  const lat = toFiniteNumber(firstValue(row, [`${prefix}_lat`, `${prefix}_latitude`]));
  const lon = toFiniteNumber(firstValue(row, [`${prefix}_lon`, `${prefix}_lng`, `${prefix}_longitude`]));
  return lat !== null && lon !== null ? { lat, lon } : null;
};

const normalizeStop = (stop, index = 0) => {
  const normalized = normalizeImportRow(stop);
  const point = normalizePoint(stop) || pointFromRow(normalized, "stop");
  if (!point) return null;

  return {
    ...point,
    name: firstValue(normalized, ["stop_name", "name"]) || `Stop ${index + 1}`,
    order: toFiniteNumber(firstValue(normalized, ["stop_order", "order", "sequence"])) ?? index,
  };
};

const normalizePathForBackend = (path) => {
  if (!Array.isArray(path)) return undefined;
  const normalized = path
    .map((point) => normalizePoint(point))
    .filter(Boolean)
    .map((point) => [point.lat, point.lon]);
  return normalized.length > 1 ? normalized : undefined;
};

const normalizeJsonRoutes = (payload) => {
  const routes = Array.isArray(payload) ? payload : payload?.routes;
  if (!Array.isArray(routes)) {
    throw new Error("JSON file must contain an array of routes or an object with a routes array.");
  }

  return routes.map((route, index) => {
    const normalized = normalizeImportRow(route);
    const start = normalizePoint(route.start) || pointFromRow(normalized, "start") || pointFromRow(normalized, "origin");
    const end = normalizePoint(route.end) || pointFromRow(normalized, "end") || pointFromRow(normalized, "destination");
    const stops = Array.isArray(route.stops)
      ? route.stops.map((stop, stopIndex) => normalizeStop(stop, stopIndex)).filter(Boolean)
      : [];

    return {
      name: firstValue(normalized, ["route_name", "name"]) || `Imported Route ${index + 1}`,
      bus_number: firstValue(normalized, ["bus_number", "bus", "vehicle_number"]),
      start_name: firstValue(normalized, ["start_name", "origin_name"]) || "Start",
      end_name: firstValue(normalized, ["end_name", "destination_name"]) || "End",
      total_distance: toFiniteNumber(firstValue(normalized, ["total_distance", "total_distance_meters", "distance"])),
      path: normalizePathForBackend(route.path || route.path_coords || route.route_geometry),
      start,
      end,
      stops,
    };
  });
};

const normalizeExcelRoutes = (rows) => {
  const groupedRoutes = new Map();

  rows.map(normalizeImportRow).forEach((row, index) => {
    const routeName = firstValue(row, ["route_name", "name"]) || `Imported Route ${index + 1}`;
    const routeKey = firstValue(row, ["route_id", "route_key", "route_code", "route_name", "name"]) || routeName;

    if (!groupedRoutes.has(routeKey)) {
      groupedRoutes.set(routeKey, {
        name: routeName,
        bus_number: firstValue(row, ["bus_number", "bus", "vehicle_number"]),
        start_name: firstValue(row, ["start_name", "origin_name"]) || "Start",
        end_name: firstValue(row, ["end_name", "destination_name"]) || "End",
        start: pointFromRow(row, "start") || pointFromRow(row, "origin"),
        end: pointFromRow(row, "end") || pointFromRow(row, "destination"),
        stops: [],
      });
    }

    const route = groupedRoutes.get(routeKey);
    route.start = route.start || pointFromRow(row, "start") || pointFromRow(row, "origin");
    route.end = route.end || pointFromRow(row, "end") || pointFromRow(row, "destination");

    const stop = normalizeStop(row, route.stops.length);
    if (stop) route.stops.push(stop);
  });

  return Array.from(groupedRoutes.values()).map((route) => ({
    ...route,
    stops: route.stops.sort((a, b) => a.order - b.order),
  }));
};

const AdminRouteManager = ({ onBack, preSelectedCity }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const fileInputRef = useRef(null);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(preSelectedCity || "");
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeSubTab, setRouteSubTab] = useState("library");
  const [expandedRouteId, setExpandedRouteId] = useState(null);

  // Design State
  const [newPoints, setNewPoints] = useState({ start: null, end: null });
  const [stops, setStops] = useState([]); // [{lat, lon, name}]
  const [names, setNames] = useState({ route: "", start: "", end: "" });
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // New: Alternative Routing State
  const [previews, setPreviews] = useState([]); // [{path, distance, duration}]
  const [selectedIndex, setSelectedIndex] = useState(0);

  const markers = useRef({}); // { type_id: markerInstance }

  // Initialize Map
  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [78.9629, 20.5937],
      zoom: 5,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      map.current.addSource("route-previews", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.current.addLayer({
        id: "route-previews-layer",
        type: "line",
        source: "route-previews",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["case", ["boolean", ["get", "selected"], false], "#00E676", "#94a3b8"],
          "line-width": ["case", ["boolean", ["get", "selected"], false], 7, 4],
          "line-opacity": ["case", ["boolean", ["get", "selected"], false], 0.9, 0.4],
        },
      });

      map.current.on("click", "route-previews-layer", (e) => {
        if (e.features.length > 0) {
          setSelectedIndex(e.features[0].properties.index);
        }
      });
    });

    map.current.on("click", () => {
      // Logic handled in a separate effect to have access to state
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle Map Clicks
  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e) => {
      // Check if clicked on a feature
      const features = map.current.queryRenderedFeatures(e.point, { layers: ["route-previews-layer"] });
      if (features.length > 0) return;

      const latlng = e.lngLat;
      handleMapClick({ lat: latlng.lat, lng: latlng.lng });
    };

    map.current.off("click", handleClick);
    map.current.on("click", handleClick);
    
    return () => map.current?.off("click", handleClick);
  }, [isAddingStop, newPoints, stops]);

  // Sync Markers and Previews
  useEffect(() => {
    if (!map.current) return;

    // Update Start Marker
    if (newPoints.start && !selectedRoute) {
      if (!markers.current["start"]) {
        const el = document.createElement("div");
        el.className = "w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-lg cursor-move";
        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([newPoints.start.lng || newPoints.start.lon, newPoints.start.lat])
          .addTo(map.current);
        
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          handleDrag("start", { lat: lngLat.lat, lng: lngLat.lng });
        });
        markers.current["start"] = marker;
      } else {
        markers.current["start"].setLngLat([newPoints.start.lng || newPoints.start.lon, newPoints.start.lat]);
      }
    } else if (markers.current["start"]) {
      markers.current["start"].remove();
      delete markers.current["start"];
    }

    // Update End Marker
    if (newPoints.end && !selectedRoute) {
      if (!markers.current["end"]) {
        const el = document.createElement("div");
        el.className = "w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg cursor-move";
        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([newPoints.end.lng || newPoints.end.lon, newPoints.end.lat])
          .addTo(map.current);
        
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          handleDrag("end", { lat: lngLat.lat, lng: lngLat.lng });
        });
        markers.current["end"] = marker;
      } else {
        markers.current["end"].setLngLat([newPoints.end.lng || newPoints.end.lon, newPoints.end.lat]);
      }
    } else if (markers.current["end"]) {
      markers.current["end"].remove();
      delete markers.current["end"];
    }

    // Update Stop Markers
    const currentStopIds = new Set();
    if (!selectedRoute) {
      stops.forEach((s, i) => {
        const id = `stop-${i}`;
        currentStopIds.add(id);
        if (!markers.current[id]) {
          const el = document.createElement("div");
          el.className = "flex items-center justify-center bg-indigo-600 text-white w-6 h-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold cursor-move";
          el.innerHTML = i + 1;
          const marker = new maplibregl.Marker({ element: el, draggable: true })
            .setLngLat([s.lng || s.lon, s.lat])
            .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
            .addTo(map.current);
          
          marker.on("dragend", () => {
            const lngLat = marker.getLngLat();
            handleDrag("stop", { lat: lngLat.lat, lng: lngLat.lng }, i);
          });
          markers.current[id] = marker;
        } else {
          markers.current[id].setLngLat([s.lng || s.lon, s.lat]);
          markers.current[id].getElement().innerHTML = i + 1;
        }
      });
    }

    // Update Selected Route Markers
    if (selectedRoute) {
      selectedRoute.stops.forEach((s, i) => {
        const id = `route-stop-${i}`;
        currentStopIds.add(id);
        if (!markers.current[id]) {
          const el = document.createElement("div");
          el.className = "flex items-center justify-center bg-indigo-600 text-white w-6 h-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold";
          el.innerHTML = i + 1;
          markers.current[id] = new maplibregl.Marker({ element: el })
            .setLngLat([s.lng || s.lon, s.lat])
            .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
            .addTo(map.current);
        } else {
          markers.current[id].setLngLat([s.lng || s.lon, s.lat]);
        }
      });
    }

    Object.keys(markers.current).forEach(id => {
      if ((id.startsWith("stop-") || id.startsWith("route-stop-")) && !currentStopIds.has(id)) {
        markers.current[id].remove();
        delete markers.current[id];
      }
    });

    // Update GeoJSON Previews
    if (map.current.isStyleLoaded()) {
      const source = map.current.getSource("route-previews");
      if (source) {
        let features = [];
        if (selectedRoute) {
          features.push({
            type: "Feature",
            properties: { selected: true, index: 0 },
            geometry: {
              type: "LineString",
              coordinates: selectedRoute.path_coords.map(p => [p[1], p[0]]),
            },
          });
        } else if (previews.length > 0) {
          features = previews.map((p, idx) => ({
            type: "Feature",
            properties: { selected: idx === selectedIndex, index: idx },
            geometry: {
              type: "LineString",
              coordinates: p.path.map(coord => [coord[1], coord[0]]),
            },
          }));
        } else if (newPoints.start && newPoints.end) {
           features.push({
            type: "Feature",
            properties: { selected: false, index: 0, dash: true },
            geometry: {
              type: "LineString",
              coordinates: [
                [newPoints.start.lng || newPoints.start.lon, newPoints.start.lat],
                [newPoints.end.lng || newPoints.end.lon, newPoints.end.lat]
              ],
            },
          });
        }
        source.setData({ type: "FeatureCollection", features });
      }
    }

    // Auto Zoom
    if (selectedRoute || (newPoints.start && newPoints.end)) {
      const points = [];
      if (selectedRoute) {
        selectedRoute.path_coords.forEach(p => points.push([p[1], p[0]]));
      } else {
        if (newPoints.start) points.push([newPoints.start.lng || newPoints.start.lon, newPoints.start.lat]);
        if (newPoints.end) points.push([newPoints.end.lng || newPoints.end.lon, newPoints.end.lat]);
        stops.forEach(s => points.push([s.lng || s.lon, s.lat]));
      }
      
      if (points.length > 0) {
        const bounds = points.reduce((acc, coord) => acc.extend(coord), new maplibregl.LngLatBounds(points[0], points[0]));
        map.current.fitBounds(bounds, { padding: 80, duration: 1500 });
      }
    }
  }, [newPoints, stops, previews, selectedIndex, selectedRoute]);

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
    } catch {
      alert("Failed to save route. Check backend logs.");
    } finally {
      setLoading(false);
    }
  };

  const createImportedRoute = async (route) => {
    if (!route.start || !route.end) {
      throw new Error(`${route.name} is missing start or end coordinates.`);
    }

    const payload = {
      city: selectedCity,
      name: route.name,
      bus_number: route.bus_number || "",
      start_name: route.start_name || "Start",
      end_name: route.end_name || "End",
      start: route.start,
      end: route.end,
      stops: (route.stops || []).map((stop, index) => ({
        lat: stop.lat,
        lon: stop.lon,
        name: stop.name || `Stop ${index + 1}`,
        order: stop.order ?? index,
      })),
    };

    if (route.path) payload.path = route.path;
    if (route.total_distance) payload.total_distance = route.total_distance;

    await api.post("/api/admin/routes/", payload);
  };

  const parseImportFile = async (file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "json") {
      const text = await file.text();
      return normalizeJsonRoutes(JSON.parse(text));
    }

    if (extension === "xlsx" || extension === "xls") {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      return normalizeExcelRoutes(rows);
    }

    throw new Error("Unsupported file type. Upload a .json, .xlsx, or .xls file.");
  };

  const handleImportRoutes = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!selectedCity) {
      setImportResult({ type: "error", message: "Select a city before importing routes." });
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const importedRoutes = await parseImportFile(file);
      if (!importedRoutes.length) {
        throw new Error("No routes found in the uploaded file.");
      }

      const result = { success: 0, failed: [] };

      for (const route of importedRoutes) {
        try {
          await createImportedRoute(route);
          result.success += 1;
        } catch (error) {
          result.failed.push({
            name: route.name,
            message: error.response?.data?.error || error.message || "Import failed",
          });
        }
      }

      await fetchRoutes();
      setImportResult({
        type: result.failed.length ? "warning" : "success",
        message: `${result.success} route${result.success === 1 ? "" : "s"} imported${result.failed.length ? `, ${result.failed.length} failed` : ""}.`,
        failed: result.failed,
      });
    } catch (error) {
      setImportResult({ type: "error", message: error.message || "Route import failed." });
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setNewPoints({ start: null, end: null });
    setStops([]);
    setNames({ route: "", start: "", end: "" });
    setSelectedRoute(null);
    setPreviews([]);
  };

  const openRoutePreview = (route) => {
    setSelectedRoute(route);
    setExpandedRouteId(route.id);
    setRouteSubTab("library");
  };

  const stopListForRoute = (route) => {
    if (!route) return [];
    return [...(route.stops || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const isRouteLibrary = routeSubTab === "library";
  const isRouteCreate = routeSubTab === "create";

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

        {/* FIXED SUBTABS */}
        <div className="bg-white px-6 py-4 border-b border-slate-100 shadow-sm z-[20]">
          {/* Route Workspace Tabs */}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setRouteSubTab("library")}
              className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
                isRouteLibrary
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Saved Routes
            </button>
            <button
              type="button"
              onClick={() => setRouteSubTab("create")}
              className={`flex-1 h-10 rounded-xl text-[11px] font-black uppercase tracking-widest transition ${
                isRouteCreate
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Add New Route
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-6">
            {isRouteLibrary && (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Route Library
                  </h3>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {routes.length} total
                  </span>
                </div>
                <div className="grid gap-3">
                  {routes.map((route) => {
                    const routeStops = stopListForRoute(route);
                    const isExpanded = expandedRouteId === route.id;

                    return (
                      <div
                        key={route.id}
                        className={`rounded-3xl border bg-white overflow-hidden transition-shadow ${selectedRoute?.id === route.id ? "border-indigo-300 shadow-lg shadow-indigo-100" : "border-slate-100 hover:shadow-md"}`}
                      >
                        <button
                          type="button"
                          onClick={() => openRoutePreview(route)}
                          className="w-full p-4 text-left flex items-start gap-4 justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                                <Bus size={18} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-900 truncate">
                                  {route.name}
                                </h4>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 truncate">
                                  {route.start_name} → {route.end_name}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {route.stops_count ?? routeStops.length} stops
                              </span>
                              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                {route.is_public ? "Public" : "Private"}
                              </span>
                              {route.total_distance_meters ? (
                                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                  {(route.total_distance_meters / 1000).toFixed(1)} km
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                              <ChevronDown size={16} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                              Show Stops
                            </span>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Stop List
                              </p>
                              <button
                                type="button"
                                onClick={() => setExpandedRouteId(null)}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                              >
                                Close
                              </button>
                            </div>
                            <div className="space-y-2">
                              {routeStops.length === 0 ? (
                                <div className="rounded-2xl bg-white border border-dashed border-slate-200 p-4 text-[11px] font-medium text-slate-400">
                                  No stop data available for this route.
                                </div>
                              ) : (
                                routeStops.map((stop, index) => (
                                  <div key={`${route.id}-${stop.id || index}`} className="rounded-2xl bg-white border border-slate-100 p-3 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                                      {stop.order ?? index + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">
                                        {stop.name}
                                      </p>
                                      <p className="text-[10px] font-medium text-slate-400">
                                        {typeof stop.lat === "number" && typeof stop.lon === "number"
                                          ? `${stop.lat.toFixed(5)}, ${stop.lon.toFixed(5)}`
                                          : "Coordinates unavailable"}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isRouteCreate && (
            <div className="space-y-6">
              {/* Bulk Route Import */}
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Bulk Import
                    </label>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500 font-medium">
                      Upload JSON or Excel routes for the selected city.
                    </p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload size={16} />
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.xlsx,.xls,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleImportRoutes}
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing || !selectedCity}
                    className="h-10 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <FileSpreadsheet size={14} />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing || !selectedCity}
                    className="h-10 rounded-xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <FileJson size={14} />
                    JSON
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-500 font-semibold">
                  Excel columns: route_name, start_lat, start_lon, end_lat, end_lon,
                  stop_name, stop_lat, stop_lon, stop_order.
                </div>

                {importing && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-[11px] font-bold text-indigo-700">
                    Importing routes...
                  </div>
                )}

                {importResult && (
                  <div className={`rounded-xl border p-3 text-[11px] font-bold ${
                    importResult.type === "success"
                      ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                      : importResult.type === "warning"
                        ? "bg-amber-50 border-amber-100 text-amber-700"
                        : "bg-red-50 border-red-100 text-red-700"
                  }`}>
                    <p>{importResult.message}</p>
                    {importResult.failed?.length > 0 && (
                      <ul className="mt-2 space-y-1 font-medium">
                        {importResult.failed.slice(0, 3).map((failure, idx) => (
                          <li key={`${failure.name}-${idx}`}>
                            {failure.name}: {failure.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

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
            )}
          </div>
        </div>
      </div>

      {/* --- Map Area --- */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="h-full w-full" />

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
