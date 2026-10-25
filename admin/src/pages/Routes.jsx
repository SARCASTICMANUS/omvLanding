import { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as XLSX from "xlsx";
import api from "../api/client";
import LocationSearch from "../components/LocationSearch";
import EmptyState from "../components/EmptyState";
import Loader from "../components/Loader";
import { getAccentColor, ACCENT_CHANGE_EVENT } from "../utils/glow";
import {
  Plus, Save, Trash2, XCircle,
  ArrowUp, ArrowDown, Bike, Compass, Box, Edit3,
  Route as RouteIcon, Upload, FileSpreadsheet, ChevronRight, ChevronDown, Check, RefreshCw,
} from "lucide-react";

const DEFAULT_CENTER = [78.9629, 20.5937];
const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const geoJsonify = (coords) => ({
  type: "FeatureCollection",
  features: coords.length
    ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }]
    : [],
});

function parseFileClientSide(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target.result;
        const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
        let workbook;
        if (isExcel) {
          workbook = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false });
        } else {
          const text = new TextDecoder("utf-8").decode(buf);
          workbook = XLSX.read(text, { type: "string", cellDates: false });
        }
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        if (raw.length < 2) {
          resolve({ columns: [], rows: [], totalRows: 0 });
          return;
        }

        const knownHeaders = [
          "direction", "type", "stop seq", "role", "traced name",
          "verified map name", "verified address", "nearby landmark",
          "landmark address", "latitude", "longitude", "plus code",
          "full plus code", "complete road path"
        ];

        let bestIdx = 0;
        let bestHits = 0;
        for (let i = 0; i < raw.length; i++) {
          const cells = raw[i].map((c) => String(c ?? "").toLowerCase().trim());
          let hits = 0;
          for (const cell of cells) {
            for (const kw of knownHeaders) {
              if (cell === kw || cell.includes(kw)) {
                hits++;
                break;
              }
            }
          }
          if (hits > bestHits) {
            bestHits = hits;
            bestIdx = i;
          }
        }

        if (bestHits < 2) {
          resolve({ columns: [], rows: [], totalRows: 0, error: "Could not find stop data table in file" });
          return;
        }

        const headerIdx = bestIdx;
        const headers = raw[headerIdx].map((h) => String(h ?? "").trim());
        const rows = raw.slice(headerIdx + 1)
          .filter((r) => r && r.length > 0 && r.some((c) => String(c ?? "").trim() !== ""))
          .map((r) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = String(r[i] ?? "").trim(); });
            return obj;
          });

        const meta = {};
        for (let i = 0; i < headerIdx; i++) {
          const cells = raw[i].map((c) => String(c ?? "").trim());
          for (let j = 0; j < cells.length - 1; j += 2) {
            const key = cells[j].toLowerCase();
            const val = cells[j + 1];
            if (key.includes("route name")) meta.routeName = val;
            if (key.includes("route id")) meta.routeCode = val;
            if (key === "start") meta.startName = val;
            if (key === "end") meta.endName = val;
          }
        }

        resolve({ columns: headers.filter(Boolean), rows, totalRows: rows.length, meta });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export default function Routes() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({});
  const startRef = useRef(null);
  const endRef = useRef(null);
  const stopsRef = useRef([]);
  const startNameRef = useRef("");
  const endNameRef = useRef("");
  const previewRequestRef = useRef(0);

  const [cities, setCities] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [globalStopQuery, setGlobalStopQuery] = useState("");
  const [globalStopResults, setGlobalStopResults] = useState([]);
  const [globalStopNearby, setGlobalStopNearby] = useState(null);
  const [globalStopRadius, setGlobalStopRadius] = useState(5000);
  const [selectedGlobalStops, setSelectedGlobalStops] = useState([]);
  const [globalStopMode, setGlobalStopMode] = useState(false);
  const [routeMembershipDraft, setRouteMembershipDraft] = useState([]);
  const [tab, setTab] = useState("library");
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [stops, setStops] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [routeCode, setRouteCode] = useState("");
  const [directionName, setDirectionName] = useState("");
  const [routeMetadataDraft, setRouteMetadataDraft] = useState({ name: "", route_code: "", direction_name: "" });
  const [startName, setStartName] = useState("");
  const [endName, setEndName] = useState("");
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [selectedPreview, setSelectedPreview] = useState(0);
  const [previewError, setPreviewError] = useState("");

  const [mapLoaded, setMapLoaded] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [bearing, setBearing] = useState(0);

  const [importStep, setImportStep] = useState(0);
  const [importColumns, setImportColumns] = useState([]);
  const [importRows, setImportRows] = useState([]);
  const [importTotalRows, setImportTotalRows] = useState(0);
  const [importMapping, setImportMapping] = useState({ name: "", latitude: "", longitude: "", order: "", plusCode: "", nearbyLandmark: "", roadPath: "" });
  const [importRoadPath, setImportRoadPath] = useState([]);
  const [importRoadPathError, setImportRoadPathError] = useState("");
  const [importRouteName, setImportRouteName] = useState("");
  const [importRouteCode, setImportRouteCode] = useState("");
  const [importPreviewStops, setImportPreviewStops] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => { api.get("/transport/cities/").then((r) => {
    const d = Array.isArray(r.data) ? r.data : r.data.results || [];
    setCities(d);
    if (d.length) {
      setSelectedCity(d[0].id);
      const loc = d[0].location?.coordinates;
      if (loc && map.current) map.current.flyTo({ center: [loc[0], loc[1]], zoom: 12, duration: 1000 });
    }
  }).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedCity) return;
    api.get(`/transport/routes/?city_id=${selectedCity}`).then((r) => {
      setRoutes(Array.isArray(r.data) ? r.data : r.data.results || []);
    }).catch(() => {});
  }, [selectedCity]);

  useEffect(() => {
    if (!selectedCity || (globalStopQuery.trim().length < 2 && !globalStopNearby)) {
      setGlobalStopResults([]);
      return;
    }
    const timer = setTimeout(() => {
      const params = { scope: "global", city: selectedCity, has_coordinates: 1, limit: 15 };
      if (globalStopQuery.trim().length >= 2) params.q = globalStopQuery.trim();
      if (globalStopNearby) Object.assign(params, {
        near_lat: globalStopNearby.lat, near_lng: globalStopNearby.lon, radius_m: globalStopRadius,
      });
      api.get("/transport/admin/stops/", {
        params,
      }).then((r) => setGlobalStopResults(r.data?.results || r.data?.data || []))
        .catch(() => setGlobalStopResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [selectedCity, globalStopQuery, globalStopNearby, globalStopRadius]);

  const fetchRouteDetail = async (route) => {
    try {
      const res = await api.get(`/transport/routes/${route.id}/`);
      const detail = res.data?.data || res.data;
      setSelectedRoute(detail);
      setRouteMetadataDraft({ name: detail.name || "", route_code: detail.route_code || "", direction_name: detail.direction_name || "" });
      setRouteMembershipDraft(detail.route_memberships || []);
    } catch (err) { console.error("Route error:", err); alert("Failed to select route"); }
  };

  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 12,
      maxZoom: 22,
      renderWorldCopies: true,
    });

    map.current.on("load", () => {
      map.current.addSource("route-path", { type: "geojson", data: geoJsonify([]) });
      map.current.addLayer({
        id: "route-path-layer",
        type: "line",
        source: "route-path",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": getAccentColor().hex, "line-width": 6, "line-opacity": 0.9 },
      });
      setMapLoaded(true);
    });

    map.current.on("moveend", () => {
      setPitch(map.current.getPitch());
      setBearing(map.current.getBearing());
    });
  }, []);

  useEffect(() => {
    const onAccent = () => {
      try {
        if (map.current && map.current.getLayer("route-path-layer")) {
          map.current.setPaintProperty("route-path-layer", "line-color", getAccentColor().hex);
        }
      } catch (err) { console.error("Route error:", err); alert("An error occurred"); }
    };
    window.addEventListener(ACCENT_CHANGE_EVENT, onAccent);
    return () => window.removeEventListener(ACCENT_CHANGE_EVENT, onAccent);
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const clickHandler = (e) => {
      if (tab !== "create") return;
      if (selectedRoute) return;
      const { lng, lat } = e.lngLat;
      const curStart = startRef.current;
      const curEnd = endRef.current;
      const curStops = stopsRef.current;
      if (isAddingStop && curStart && curEnd) {
        const addedStop = { lat, lon: lng, name: "", generated_name: true };
        const stopsWithNew = [...curStops, addedStop];
        const unnamedCount = stopsWithNew.filter((stop) => stop.generated_name).length;
        let unnamedIndex = 0;
        const updated = stopsWithNew.map((stop) => stop.generated_name
          ? { ...stop, name: unnamedCount === 1 ? "Nearest OMV Stop" : `OMV Stop ${++unnamedIndex}` }
          : stop);
        setStops(updated);
        stopsRef.current = updated;
        setIsAddingStop(false);
        fitToBounds();
        fetchPreview(curStart, curEnd, updated, startNameRef.current, endNameRef.current);
      } else if (!curStart) {
        const pt = { lat, lon: lng };
        setStart(pt);
        startRef.current = pt;
        reverseGeocode(lat, lng, setStartName);
        fitToBounds();
      } else if (!curEnd) {
        const pt = { lat, lon: lng };
        setEnd(pt);
        endRef.current = pt;
        reverseGeocode(lat, lng, setEndName);
        fitToBounds();
        fetchPreview(startRef.current, pt, stopsRef.current, startNameRef.current, "");
      }
    };

    map.current.on("click", clickHandler);
    return () => {
      map.current.off("click", clickHandler);
    };
  }, [tab, isAddingStop]);

  const zoomToCity = (cityId) => {
    const city = cities.find((c) => c.id === cityId);
    if (!city?.location?.coordinates) return;
    const [lng, lat] = city.location.coordinates;
    if (!map.current) return;
    map.current.flyTo({ center: [lng, lat], zoom: 12, duration: 1000 });
  };

  const reverseGeocode = async (lat, lon, cb) => {
    try {
      const res = await api.get(
        `/transport/geocode/reverse/?lat=${lat}&lon=${lon}`
      );
      const data = res.data;
      if (data.display_name) cb(data.display_name);
    } catch (err) { console.error("Route error:", err); alert("An error occurred"); }
  };

  const fetchPreview = async (s, e, st, sn, en) => {
    if (!s || !e) return;
    const requestId = ++previewRequestRef.current;
    setPreviewError("");
    setPreviews([]);
    setSelectedPreview(0);
    try {
      const res = await api.post("/transport/routes/preview/", {
        start: { lat: s.lat, lon: s.lon, name: sn || "" },
        end: { lat: e.lat, lon: e.lon, name: en || "" },
        stops: (st || []).map((s, i) => ({ lat: s.lat, lon: s.lon, name: s.name, order: i })),
      });
      if (requestId !== previewRequestRef.current) return;
      const routePreviews = Array.isArray(res.data) ? res.data : [];
      setPreviews(routePreviews);
      setSelectedPreview(0);
      if (!routePreviews.length) setPreviewError("The routing service returned no route alternatives for these stops.");
      return routePreviews;
    } catch (err) {
      if (requestId !== previewRequestRef.current) return;
      setPreviews([]);
      console.error("Route geometry preview failed:", err);
      const reason = err.response?.data?.message || err.response?.data?.detail || err.message || "Road geometry generation failed.";
      setPreviewError(typeof reason === "string" ? reason : JSON.stringify(reason));
    }
  };

  const applyGlobalStopSequence = async (sequence) => {
    setSelectedGlobalStops(sequence);
    previewRequestRef.current += 1;
    setPreviews([]);
    if (sequence.length < 2) return;
    const point = (stop) => ({ lat: Number(stop.lat), lon: Number(stop.lng) });
    const nextStart = point(sequence[0]);
    const nextEnd = point(sequence[sequence.length - 1]);
    const middle = sequence.slice(1, -1).map((stop) => ({ ...point(stop), name: stop.name }));
    setStart(nextStart); setEnd(nextEnd); setStops(middle);
    setStartName(sequence[0].name); setEndName(sequence[sequence.length - 1].name);
    startRef.current = nextStart; endRef.current = nextEnd; stopsRef.current = middle;
    startNameRef.current = sequence[0].name; endNameRef.current = sequence[sequence.length - 1].name;
    await fetchPreview(nextStart, nextEnd, middle, sequence[0].name, sequence[sequence.length - 1].name);
  };

  const fitToBounds = () => {
    if (!map.current) return;
    const m = map.current;
    const points = [];
    if (startRef.current) points.push([startRef.current.lon, startRef.current.lat]);
    stopsRef.current.forEach((s) => points.push([s.lon, s.lat]));
    if (endRef.current) points.push([endRef.current.lon, endRef.current.lat]);
    if (points.length > 1) {
      const bounds = points.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(points[0], points[0]));
      m.fitBounds(bounds, { padding: 80, duration: 1000 });
    } else if (points.length === 1) {
      m.setCenter(points[0]);
      m.setZoom(14);
    }
  };

  useEffect(() => {
    if (!map.current) return;
    const m = map.current;

    Object.values(markers.current).forEach((mk) => mk.remove());
    markers.current = {};

    if (selectedRoute) {
      const route = selectedRoute;
      const path = route.path?.coordinates || [];
      const useGlobalMemberships = routeMembershipDraft.length > 0 || (route.route_memberships || []).length > 0;
      const mapStops = useGlobalMemberships ? routeMembershipDraft : route.stops || [];
      const src = m.getSource("route-path");
      if (src) src.setData(geoJsonify(path));

      if (path.length) {
        const bounds = path.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(path[0], path[0]));
        m.fitBounds(bounds, { padding: 80, duration: 1000 });
      }

      mapStops.forEach((s, i) => {
        const coords = s.location?.coordinates || [s.lng, s.lat];
        if (coords.length < 2 || !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return;
        const el = document.createElement("div");
        el.className = "flex items-center justify-center text-white w-7 h-7 rounded-full border-2 border-white/80 shadow-md text-[11px] font-semibold";
        el.style.backgroundColor = "var(--accent-blue)";
        el.innerHTML = i + 1;
        const mk = new maplibregl.Marker({ element: el, draggable: !useGlobalMemberships })
          .setLngLat(coords)
          .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
          .addTo(m);
        if (!useGlobalMemberships) {
          mk.on("dragend", async () => {
            const pos = mk.getLngLat();
            const newCoords = [pos.lng, pos.lat];
            s.location.coordinates = newCoords;
            await api.patch(`/transport/admin/stops/${s.id}/`, {
              location: { type: "Point", coordinates: newCoords },
            });
          });
        }
        markers.current[`s-${i}`] = mk;
      });
      return;
    }

    if (start) {
      const el = document.createElement("div");
      el.className = "w-5 h-5 bg-emerald-500 rounded-full border-2 border-white/80 shadow-lg cursor-grab";
      const mk = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([start.lon, start.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setText(startName || "Start"))
        .addTo(m);
      mk.on("dragend", () => {
        const pos = mk.getLngLat();
        const pt = { lat: pos.lat, lon: pos.lng };
        setStart(pt);
        startRef.current = pt;
        reverseGeocode(pos.lat, pos.lng, setStartName);
        fetchPreview(pt, endRef.current, stopsRef.current, "", endNameRef.current);
      });
      markers.current["start"] = mk;
    }

    if (end) {
      const el = document.createElement("div");
      el.className = "w-5 h-5 bg-red-500 rounded-full border-2 border-white/80 shadow-lg cursor-grab";
      const mk = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([end.lon, end.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setText(endName || "End"))
        .addTo(m);
      mk.on("dragend", () => {
        const pos = mk.getLngLat();
        const pt = { lat: pos.lat, lon: pos.lng };
        setEnd(pt);
        endRef.current = pt;
        reverseGeocode(pos.lat, pos.lng, setEndName);
        fetchPreview(startRef.current, pt, stopsRef.current, startNameRef.current, "");
      });
      markers.current["end"] = mk;
    }

    stops.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "flex items-center justify-center text-white w-6 h-6 rounded-full border-2 border-white/80 shadow-md text-[10px] font-semibold cursor-grab";
      el.style.backgroundColor = "var(--accent-blue)";
      el.innerHTML = i + 1;
      const mk = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([s.lon, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
        .addTo(m);
      mk.on("dragend", () => {
        const pos = mk.getLngLat();
        const updated = [...stops];
        updated[i] = { ...updated[i], lat: pos.lat, lon: pos.lng };
        setStops(updated);
        stopsRef.current = updated;
        fetchPreview(startRef.current, endRef.current, updated, startNameRef.current, endNameRef.current);
      });
      markers.current[`stop-${i}`] = mk;
    });
  }, [start, end, stops, selectedRoute, routeMembershipDraft, mapLoaded]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const src = map.current.getSource("route-path");
    if (!src) return;
    if (selectedPreview >= 0 && previews[selectedPreview]) {
      src.setData(geoJsonify(previews[selectedPreview].path));
    } else {
      src.setData(geoJsonify([]));
    }
  }, [previews, selectedPreview, mapLoaded]);

  const toggle3D = () => {
    if (!map.current) return;
    const next = !is3D;
    setIs3D(next);
    map.current.easeTo({ pitch: next ? 60 : 0, bearing: next ? -20 : 0, duration: 600 });
  };

  const resetView = () => {
    setIs3D(false);
    map.current?.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  };

  const saveRoute = async () => {
    if (!start || !end || !selectedCity) return;
    setLoading(true);
    let createdRouteId = null;
    const preview = previews[selectedPreview];
    const pathCoords = preview?.path;
    try {
      if (!globalStopMode || selectedGlobalStops.length < 2) {
        throw new Error("Choose at least two existing global stops for the route direction.");
      }
      if (!Array.isArray(pathCoords) || pathCoords.length < 2) {
        throw new Error("Road geometry is unavailable. Load a route preview before saving.");
      }
      const res = await api.post("/transport/admin/routes/", {
        city: selectedCity,
        name: routeName || "New Route",
        route_code: routeCode,
        direction_name: directionName,
        start_name: startName,
        end_name: endName,
        path: { type: "LineString", coordinates: pathCoords },
        total_distance_meters: preview?.distance || 0,
        is_public: false,
      });
      const routeId = res.data?.data?.id || res.data?.id;
      if (!routeId) throw new Error("The backend did not return the created route ID.");
      createdRouteId = routeId;
      await api.put(`/transport/admin/routes/${routeId}/ordered-stops/`, {
        stops: selectedGlobalStops.map((stop, order) => ({
          stop_id: stop.id, order, boarding_allowed: true, alighting_allowed: true,
        })),
        path: { type: "LineString", coordinates: pathCoords },
        total_distance_meters: preview.distance,
        start_name: selectedGlobalStops[0].name,
        end_name: selectedGlobalStops[selectedGlobalStops.length - 1].name,
      });
      resetForm();
      api.get(`/transport/routes/?city_id=${selectedCity}`).then((r) => {
        setRoutes(Array.isArray(r.data) ? r.data : r.data.results || []);
      });
    } catch (err) {
      const reason = err.response?.data?.message || err.response?.data?.detail || err.response?.data;
      const detail = typeof reason === "string" ? reason : JSON.stringify(reason || err.message);
      if (createdRouteId) {
        await fetchRouteDetail({ id: createdRouteId });
        alert(`The private route draft was created, but its stop order could not be saved. The draft is open so you can retry. Reason: ${detail}`);
      } else {
        alert("Failed to save route: " + detail);
      }
    }
    setLoading(false);
  };

  const resetForm = () => {
    previewRequestRef.current += 1;
    setStart(null); setEnd(null); setStops([]);
    setRouteName(""); setStartName(""); setEndName("");
    setRouteCode(""); setDirectionName("");
    setPreviews([]); setSelectedPreview(0); setPreviewError("");
    setSelectedRoute(null);
    startRef.current = null; endRef.current = null; stopsRef.current = [];
    startNameRef.current = ""; endNameRef.current = "";
    setSelectedGlobalStops([]); setGlobalStopMode(false); setGlobalStopQuery(""); setGlobalStopResults([]);
  };

  const reorderStop = (idx, dir) => {
    const t = idx + dir;
    if (t < 0 || t >= stops.length) return;
    const updated = [...stops];
    [updated[idx], updated[t]] = [updated[t], updated[idx]];
    setStops(updated);
    stopsRef.current = updated;
    fetchPreview(start, end, updated, startName, endName);
  };

  const editRouteStop = async (stop) => {
    const newName = prompt("Enter new stop name:", stop.name);
    if (newName && newName !== stop.name) {
      await api.patch(`/transport/admin/stops/${stop.id}/`, { name: newName });
      fetchRouteDetail(selectedRoute);
    }
  };

  const saveRouteMemberships = async () => {
    if (!selectedRoute) return;
    if (routeMembershipDraft.length < 2) {
      alert("A route direction needs at least two ordered global stops.");
      return;
    }
    try {
      const coordinates = routeMembershipDraft.map((stop) => stop.location?.coordinates || [stop.lng, stop.lat]);
      if (coordinates.some((point) => point.length < 2 || point.some((value) => !Number.isFinite(Number(value))))) {
        throw new Error("Every selected global stop must have valid coordinates.");
      }
      const previewResponse = await api.post("/transport/routes/preview/", {
        start: { lon: coordinates[0][0], lat: coordinates[0][1] },
        end: { lon: coordinates.at(-1)[0], lat: coordinates.at(-1)[1] },
        stops: coordinates.slice(1, -1).map(([lon, lat]) => ({ lon, lat })),
      });
      const preview = Array.isArray(previewResponse.data) ? previewResponse.data[0] : null;
      if (!Array.isArray(preview?.path) || preview.path.length < 2) {
        throw new Error("The road router did not return valid geometry for this stop order.");
      }
      const stops = routeMembershipDraft.map((stop, order) => ({
        stop_id: stop.id, order,
        boarding_allowed: stop.boarding_allowed !== false,
        alighting_allowed: stop.alighting_allowed !== false,
      }));
      await api.put(`/transport/admin/routes/${selectedRoute.id}/ordered-stops/`, {
        stops,
        path: { type: "LineString", coordinates: preview.path },
        total_distance_meters: preview.distance,
        start_name: routeMembershipDraft[0].name,
        end_name: routeMembershipDraft.at(-1).name,
      });
      await fetchRouteDetail(selectedRoute);
    } catch (err) {
      alert("Failed to save ordered stops: " + (err.response?.data?.message || err.response?.data?.detail || err.message));
    }
  };

  const saveRouteMetadata = async () => {
    if (!selectedRoute) return;
    try {
      await api.patch(`/transport/admin/routes/${selectedRoute.id}/`, routeMetadataDraft);
      await fetchRouteDetail({ ...selectedRoute, ...routeMetadataDraft });
    } catch (err) {
      alert("Failed to save route details: " + (err.response?.data?.detail || err.response?.data?.message || err.message));
    }
  };

  const setRoutePublished = async (isPublic) => {
    if (!selectedRoute) return;
    try {
      const response = await api.patch(`/transport/admin/routes/${selectedRoute.id}/`, { is_public: isPublic });
      const detail = response.data?.data || response.data;
      setSelectedRoute(detail);
    } catch (err) {
      alert("Failed to update publication status: " + (err.response?.data?.message || err.message));
    }
  };

  const deleteRouteStop = async (stop) => {
    if (!window.confirm(`Delete stop "${stop.name}"?`)) return;
    await api.delete(`/transport/admin/stops/${stop.id}/`);
    fetchRouteDetail(selectedRoute);
  };

  const handleDeleteRoute = async (route) => {
    if (!window.confirm(`Delete route "${route.name}"? This will also delete all its stops.`)) return;
    try {
      await api.delete(`/transport/admin/routes/${route.id}/`);
      if (selectedRoute?.id === route.id) setSelectedRoute(null);
      api.get(`/transport/routes/?city_id=${selectedCity}`).then((r) => {
        setRoutes(Array.isArray(r.data) ? r.data : r.data.results || []);
      });
    } catch (err) {
      alert("Failed to delete route: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleImportFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setImportRoadPathError("");
    setImportStep(1);
    try {
      const { columns, rows, totalRows, meta, error } = await parseFileClientSide(file);
      if (error || !columns.length) {
        setImportError(error || "No columns found in file");
        setImportStep(0);
        return;
      }
      setImportColumns(columns);
      setImportRows(rows);
      setImportTotalRows(totalRows);
      if (meta?.routeName) setImportRouteName(meta.routeName);
      if (meta?.routeCode) setImportRouteCode(meta.routeCode);

      const lowerCols = columns.map((c) => c.toLowerCase());
      const autoMap = { name: "", latitude: "", longitude: "", order: "", plusCode: "", nearbyLandmark: "", roadPath: "" };
      const latIdx = lowerCols.findIndex((c) => c.includes("lat"));
      if (latIdx >= 0) autoMap.latitude = columns[latIdx];
      const lonIdx = lowerCols.findIndex((c) => c.includes("lon") || c.includes("lng"));
      if (lonIdx >= 0) autoMap.longitude = columns[lonIdx];
      const nameIdx = lowerCols.findIndex((c) => c.includes("verified map name") || c.includes("traced name"));
      if (nameIdx >= 0) autoMap.name = columns[nameIdx];
      const orderIdx = lowerCols.findIndex((c) => c.includes("stop seq") || c.includes("order") || c.includes("sequence"));
      if (orderIdx >= 0) autoMap.order = columns[orderIdx];
      const pcIdx = lowerCols.findIndex((c) => c.includes("plus code"));
      if (pcIdx >= 0) autoMap.plusCode = columns[pcIdx];
      const lmIdx = lowerCols.findIndex((c) => c.includes("nearby landmark") || c.includes("landmark"));
      if (lmIdx >= 0) autoMap.nearbyLandmark = columns[lmIdx];
      const rpIdx = lowerCols.findIndex((c) => c.includes("complete road path") || c.includes("road path"));
      if (rpIdx >= 0) autoMap.roadPath = columns[rpIdx];
      setImportMapping(autoMap);
    } catch (err) {
      setImportError("Failed to parse file: " + err.message);
      setImportStep(0);
    }
  };

  const generateImportPreview = useCallback(() => {
    if (!importMapping.latitude || !importMapping.longitude) {
      setImportPreviewStops([]);
      setImportRoadPath([]);
      setImportRoadPathError("");
      return;
    }
    const stops = [];
    importRows.forEach((row, i) => {
      const lat = parseFloat(row[importMapping.latitude]);
      const lon = parseFloat(row[importMapping.longitude]);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
      const seqVal = importMapping.order ? row[importMapping.order] : "";
      const hasSeq = seqVal !== undefined && seqVal !== null && String(seqVal).trim() !== "" && !isNaN(parseInt(String(seqVal).trim()));
      if (!hasSeq) return;
      let order = parseInt(String(seqVal).trim()) || i;
      const name = importMapping.name ? String(row[importMapping.name] || "").trim() : "";
      const plusCode = importMapping.plusCode ? (row[importMapping.plusCode] || "") : "";
      const nearbyLandmark = importMapping.nearbyLandmark ? (row[importMapping.nearbyLandmark] || "") : "";
      stops.push({ lat, lon, name, order, plus_code: plusCode, nearby_landmark: nearbyLandmark });
    });
    stops.sort((a, b) => a.order - b.order);
    const unnamedCount = stops.filter((stop) => !String(stop.name || "").trim()).length;
    let unnamedIndex = 0;
    const namedStops = stops.map((stop) => ({
      ...stop,
      name: stop.name || (unnamedCount === 1 ? "Nearest OMV Stop" : `OMV Stop ${++unnamedIndex}`),
    }));
    setImportPreviewStops(namedStops);

    let roadPath = [];
    if (importMapping.roadPath) {
      for (const row of importRows) {
        const raw = String(row[importMapping.roadPath] || "").trim();
        if (raw.length < 10) continue;
        const numbers = raw.match(/-?\d+\.?\d*/g);
        if (numbers && numbers.length >= 4) {
          for (let i = 0; i < numbers.length - 1; i += 2) {
            const rlat = parseFloat(numbers[i]);
            const rlon = parseFloat(numbers[i + 1]);
            if (rlat >= -90 && rlat <= 90 && rlon >= -180 && rlon <= 180) {
              roadPath.push([rlon, rlat]);
            }
          }
          if (roadPath.length >= 2) break;
        }
      }
    }
    setImportRoadPath(roadPath);
    setImportRoadPathError("");
  }, [importRows, importMapping]);

  const handleGenerateRoadPath = useCallback(async () => {
    if (importPreviewStops.length < 2) return;
    setImportRoadPath([]);
    setImportRoadPathError("");
    try {
      const first = importPreviewStops[0];
      const last = importPreviewStops[importPreviewStops.length - 1];
      const middleStops = importPreviewStops.slice(1, -1).map((s) => ({ lat: s.lat, lon: s.lon }));
      const res = await api.post("/transport/routes/preview/", {
        start: { lat: first.lat, lon: first.lon },
        end: { lat: last.lat, lon: last.lon },
        stops: middleStops,
      });
      const data = res.data;
      const preview = Array.isArray(data) ? data[0] : data?.path ? data : null;
      if (preview?.path?.length >= 2) {
        setImportRoadPath(preview.path);
      } else {
        setImportRoadPathError("The routing service returned no usable road geometry for these stops.");
      }
    } catch (err) {
      console.warn("Road path generation failed, using straight-line preview:", err);
      const reason = err.response?.data?.message || err.response?.data?.detail || err.message || "Road path generation failed.";
      setImportRoadPathError(typeof reason === "string" ? reason : JSON.stringify(reason));
    }
  }, [importPreviewStops]);

  useEffect(() => {
    if (importStep === 2) generateImportPreview();
  }, [importStep, importMapping, generateImportPreview]);

  useEffect(() => {
    if (importStep === 3 && importPreviewStops.length >= 2 && importRoadPath.length < 2) {
      handleGenerateRoadPath();
    }
  }, [importStep, importPreviewStops.length, handleGenerateRoadPath]);

  useEffect(() => {
    if (importStep !== 3 || !map.current || !mapLoaded) return;
    const m = map.current;

    Object.values(markers.current).forEach((mk) => mk.remove());
    markers.current = {};

    const stopCoords = importPreviewStops.map((s) => [s.lon, s.lat]);
    const lineCoords = importRoadPath.length >= 2 ? importRoadPath : stopCoords;
    const src = m.getSource("route-path");
    if (src) src.setData(geoJsonify(lineCoords));

    if (lineCoords.length > 1) {
      const bounds = lineCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(lineCoords[0], lineCoords[0]));
      m.fitBounds(bounds, { padding: 80, duration: 1000 });
    }

    importPreviewStops.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "flex items-center justify-center text-white w-7 h-7 rounded-full border-2 border-white/80 shadow-md text-[11px] font-semibold";
      el.style.backgroundColor = "var(--accent-blue)";
      el.innerHTML = i + 1;
      const mk = new maplibregl.Marker({ element: el })
        .setLngLat([s.lon, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
        .addTo(m);
      markers.current[`import-${i}`] = mk;
    });
  }, [importStep, importPreviewStops, importRoadPath, mapLoaded]);

  const handleImportSave = async () => {
    if (!selectedCity || !importRouteName || importPreviewStops.length < 2) {
      setImportError(
        !selectedCity
          ? "Select a city before importing"
          : !importRouteName
            ? "Enter a route name before importing"
            : "Need at least 2 valid stops to import"
      );
      return;
    }
    setImportLoading(true);
    setImportError("");
    try {
      const res = await api.post("/transport/admin/route-import/", {
        city: selectedCity,
        route_name: importRouteName,
        route_code: importRouteCode,
        stops: importPreviewStops.map((s) => ({ lat: s.lat, lon: s.lon, name: s.name, order: s.order, plus_code: s.plus_code || "", nearby_landmark: s.nearby_landmark || "" })),
      });
      const d = res.data?.data || res.data;
      const msg = d.message || "Route imported successfully";
      const extra = d.road_snapped
        ? `\nRoad-snapped: ${d.geometry_points} geometry points`
        : "\nRoad routing was unavailable; the route used straight-line geometry.";
      alert(msg + extra);
      resetImport();
      api.get(`/transport/routes/?city_id=${selectedCity}`).then((r) => {
        setRoutes(Array.isArray(r.data) ? r.data : r.data.results || []);
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to import";
      setImportError(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    setImportLoading(false);
  };

  const resetImport = () => {
    setImportStep(0);
    setImportColumns([]);
    setImportRows([]);
    setImportTotalRows(0);
    setImportMapping({ name: "", latitude: "", longitude: "", order: "", plusCode: "", nearbyLandmark: "", roadPath: "" });
    setImportRouteName("");
    setImportRouteCode("");
    setImportPreviewStops([]);
    setImportRoadPath([]);
    setImportRoadPathError("");
    setImportError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (map.current) {
      const src = map.current.getSource("route-path");
      if (src) src.setData(geoJsonify([]));
      Object.values(markers.current).forEach((mk) => mk.remove());
      markers.current = {};
    }
  };

  const endStopCount = (start ? 1 : 0) + (end ? 1 : 0);

  const savedMembershipOrder = [...(selectedRoute?.route_memberships || [])]
    .sort((left, right) => left.order - right.order).map((stop) => stop.id).join("|");
  const draftMembershipOrder = routeMembershipDraft.map((stop) => stop.id).join("|");
  const membershipDraftChanged = Boolean(selectedRoute) && savedMembershipOrder !== draftMembershipOrder;

  return (
    <div className="flex h-full">
      <div className="w-[420px] flex flex-col shrink-0">
        <div className="p-5 space-y-3">
          <h2 className="glass-section-title text-lg flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgb(var(--accent-blue-rgb) / 0.1)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.18)" }}>
              <RouteIcon size={18} style={{ color: "var(--accent-blue)" }} />
            </div>
            Route Manager
          </h2>
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => { setSelectedCity(e.target.value); resetForm(); zoomToCity(e.target.value); }}
              className="glass-input w-full appearance-none pl-4 pr-10 text-sm font-semibold outline-none cursor-pointer"
            >
              <option value="">Select City</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-200/50">
          <div className="glass-tab-group flex">
            <button onClick={() => { setTab("library"); setSelectedRoute(null); resetImport(); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                tab === "library" ? "glass-tab-active" : "glass-tab"
              }`}>Routes</button>
            <button onClick={() => { setTab("create"); setSelectedRoute(null); resetImport(); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                tab === "create" ? "glass-tab-active" : "glass-tab"
              }`}>Create</button>
            <button onClick={() => { setTab("import"); setSelectedRoute(null); resetForm(); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
                tab === "import" ? "glass-tab-active" : "glass-tab"
              }`}>Import</button>
          </div>
        </div>

        <div data-scroll className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "library" && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{routes.length} routes</p>
              {routes.map((r) => (
                <div key={r.id} className={`group glass-card overflow-hidden transition ${
                  selectedRoute?.id === r.id ? "border-l-[6px]" : ""
                }`}
                  style={selectedRoute?.id === r.id ? { borderColor: "rgb(var(--accent-blue-rgb) / 0.35)", boxShadow: "0 6px 24px rgb(var(--accent-blue-rgb) / 0.12)" } : {}}>
                  <div className="flex items-stretch">
                    <button onClick={() => { fetchRouteDetail(r); setTab("library"); }}
                      className="flex-1 min-w-0 p-4 text-left flex items-start">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm text-slate-800 truncate inline-flex items-center gap-1.5" title={r.name}>
                          <Bike size={14} className="shrink-0" style={{ color: "var(--accent-blue)" }} />
                          <span className="truncate">{r.name}</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium truncate" title={`${r.start_name} → ${r.end_name}`}>{r.start_name} → {r.end_name}</p>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-slate-500" style={{ background: "rgba(148,163,184,0.12)" }}>
                            {r.total_distance_meters ? `${(r.total_distance_meters / 1000).toFixed(1)} km` : "N/A"}
                          </span>
                          {r.stops_count > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue)" }}>
                              {r.stops_count} stops
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            r.is_public
                              ? "text-[#16a34a]"
                              : "text-slate-400"
                          }`} style={{
                            background: r.is_public ? "rgba(123,224,173,0.18)" : "rgba(148,163,184,0.12)",
                          }}>{r.is_public ? "Public" : "Private"}</span>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => handleDeleteRoute(r)}
                      className="px-3 flex items-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 rounded-r-2xl">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {routes.length === 0 && (
                <EmptyState
                  icon={RouteIcon}
                  title="No routes yet"
                  description="Create your first route or import from a spreadsheet"
                />
              )}
            </div>
          )}

          {tab === "create" && !selectedRoute && (
            <div className="space-y-5">
              {loading && <Loader size="sm" />}

              {previewError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p className="font-semibold">Route preview failed</p>
                  <p className="mt-1">{previewError}</p>
                  <button
                    type="button"
                    onClick={() => fetchPreview(start, end, stops, startName, endName)}
                    className="mt-3 rounded-lg bg-red-700 px-4 py-2 font-semibold text-white"
                  >
                    Retry route generation
                  </button>
                </div>
              )}

              {previews.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Path Alternatives ({previews.length})
                  </p>
                  <div className="grid gap-2">
                    {previews.map((p, i) => (
                      <button key={i} onClick={() => setSelectedPreview(i)}
                        className={`p-3 rounded-xl border text-left transition ${
                          i === selectedPreview
                            ? "glass-card-subtle"
                            : "border-slate-200 hover:border-accent-primary/40 bg-white/50"
                        }`}>
                        <p className="text-xs font-semibold text-slate-800">
                          Option {i + 1}: {(p.distance / 1000).toFixed(1)} km, {Math.round(p.duration / 60)} min
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="glass-label">Route Name</label>
                <input value={routeName} onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Downtown Express"
                  className="glass-input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="glass-label">Route code</label>
                  <input value={routeCode} onChange={(e) => setRouteCode(e.target.value)} placeholder="e.g. LKO-01" className="glass-input w-full" /></div>
                <div className="space-y-1"><label className="glass-label">Direction</label>
                  <input value={directionName} onChange={(e) => setDirectionName(e.target.value)} placeholder="e.g. SGPGI to IIM" className="glass-input w-full" /></div>
              </div>

              <div className="glass-card-subtle rounded-xl p-4 space-y-2">
                <label className="glass-label">Existing global stops, in travel order</label>
                <input value={globalStopQuery} onChange={(e) => setGlobalStopQuery(e.target.value)}
                  placeholder="Search this city's existing stops" className="glass-input w-full" />
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Optionally filter near a location</label>
                  <LocationSearch placeholder="Search geographic area" initialValue={globalStopNearby?.display_name || ""}
                    onSelect={(item) => setGlobalStopNearby(item || null)} className="w-full" />
                  <div className="flex items-center gap-2">
                    <select value={globalStopRadius} onChange={(e) => setGlobalStopRadius(Number(e.target.value))} className="glass-input flex-1">
                      {[1000, 2500, 5000, 10000, 20000].map((radius) => <option key={radius} value={radius}>{radius / 1000} km radius</option>)}
                    </select>
                    {globalStopNearby && <button type="button" className="text-xs text-slate-500" onClick={() => setGlobalStopNearby(null)}>Clear area</button>}
                  </div>
                </div>
                {globalStopResults.map((stop) => (
                  <button key={stop.id} type="button"
                    disabled={selectedGlobalStops.some((item) => item.id === stop.id) || stop.lat == null || stop.lng == null}
                    onClick={() => {
                      setGlobalStopMode(true);
                      setGlobalStopQuery(""); setGlobalStopResults([]);
                      applyGlobalStopSequence([...selectedGlobalStops, stop]);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white disabled:opacity-40">
                    <span className="block">{stop.name} · {stop.coordinate_status || "coordinates available"}</span>
                    <span className="block text-[10px] text-slate-500">{Number(stop.lat).toFixed(5)}, {Number(stop.lng).toFixed(5)}{stop.distance_m != null ? ` · ${Math.round(stop.distance_m)} m away` : ""}</span>
                  </button>
                ))}
                {selectedGlobalStops.map((stop, index) => (
                  <div key={stop.id} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs">
                    <span className="flex-1 truncate">{index + 1}. {stop.name}<small className="block text-[10px] text-slate-500">{Number(stop.lat).toFixed(5)}, {Number(stop.lng).toFixed(5)}</small></span>
                    <button type="button" title="Move up" disabled={index === 0}
                      onClick={() => {
                        const next = [...selectedGlobalStops];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        applyGlobalStopSequence(next);
                      }}><ArrowUp size={13} /></button>
                    <button type="button" title="Move down" disabled={index === selectedGlobalStops.length - 1}
                      onClick={() => {
                        const next = [...selectedGlobalStops];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        applyGlobalStopSequence(next);
                      }}><ArrowDown size={13} /></button>
                    <button type="button" title="Remove stop"
                      onClick={() => applyGlobalStopSequence(selectedGlobalStops.filter((_, i) => i !== index))}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-slate-500">Selecting global stops reuses their records and saves explicit route order. New routes stay private until published.</p>
              </div>

              {!globalStopMode && <>
              <div className="glass-card-subtle rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-12 bg-emerald-500 rounded-full shrink-0" />
                  <LocationSearch
                    placeholder="Search origin location..."
                    initialValue={startName}
                    onSelect={(item) => {
                      if (!item) return;
                      const pt = { lat: item.lat, lon: item.lon };
                      setStart(pt);
                      startRef.current = pt;
                      setStartName(item.display_name);
                      startNameRef.current = item.display_name;
                      fitToBounds();
                      if (end) fetchPreview(pt, end, stops, item.display_name, endName);
                      else setPreviews([]);
                    }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1 h-12 bg-red-500 rounded-full shrink-0" />
                  <LocationSearch
                    placeholder="Search destination location..."
                    initialValue={endName}
                    onSelect={(item) => {
                      if (!item) return;
                      const pt = { lat: item.lat, lon: item.lon };
                      setEnd(pt);
                      endRef.current = pt;
                      setEndName(item.display_name);
                      endNameRef.current = item.display_name;
                      fitToBounds();
                      if (start) fetchPreview(start, pt, stops, startName, item.display_name);
                      else setPreviews([]);
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Stops ({stops.length + endStopCount})
                  </p>
                  <button onClick={() => setIsAddingStop(!isAddingStop)}
                    disabled={!start || !end}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full transition ${
                      !start || !end ? "bg-slate-100/70 text-slate-400 cursor-not-allowed" :
                      isAddingStop ? "text-red-500" : "text-accent-primary"
                    }`}
                    style={{
                      background: !start || !end ? "rgba(148,163,184,0.12)" : isAddingStop ? "rgba(255,93,93,0.1)" : "rgb(var(--accent-blue-rgb) / 0.08)",
                    }}>
                    {isAddingStop ? <XCircle size={14} /> : <Plus size={14} />}
                    {isAddingStop ? "Cancel" : "Add Stop"}
                  </button>
                </div>

                {isAddingStop && <div className="glass-card-subtle rounded-lg px-4 py-2.5 text-xs text-slate-600 animate-pulse">Click on the map to place a stop.</div>}

                {start && (
                  <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgb(var(--accent-blue-rgb) / 0.06)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)" }}>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-semibold text-xs">1</div>
                    <span className="text-sm font-semibold text-slate-800 truncate">{startName || "Origin"}</span>
                  </div>
                )}

                {stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl p-2.5 group hover:shadow-md transition" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs shrink-0" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue)" }}>{i + 2}</div>
                    <LocationSearch
                      placeholder="Search stop location..."
                      initialValue={s.name}
                      onSelect={(item) => {
                        if (!item) return;
                        const updated = [...stops];
                        updated[i] = { lat: item.lat, lon: item.lon, name: item.display_name };
                        setStops(updated);
                        stopsRef.current = updated;
                        fetchPreview(start, end, updated, startName, endName);
                      }}
                    />
                    <button onClick={() => reorderStop(i, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-400 shrink-0"><ArrowUp size={14} /></button>
                    <button onClick={() => reorderStop(i, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-400 shrink-0"><ArrowDown size={14} /></button>
                    <button onClick={() => {
                      const filtered = stops.filter((_, idx) => idx !== i);
                      setStops(filtered);
                      stopsRef.current = filtered;
                      fetchPreview(start, end, filtered, startName, endName);
                    }} className="p-1 hover:bg-red-50 rounded text-red-400 shrink-0"><Trash2 size={14} /></button>
                  </div>
                ))}

                {end && (
                  <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,93,93,0.10)", border: "1px solid rgba(255,93,93,0.25)" }}>
                    <div className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center font-semibold text-xs">{stops.length + 2}</div>
                    <span className="text-sm font-semibold text-slate-800 truncate">{endName || "Destination"}</span>
                  </div>
                )}
              </div>

              </>}

              <button onClick={saveRoute} disabled={!end || loading || !globalStopMode || selectedGlobalStops.length < 2}
                className="glass-btn-primary w-full py-4 flex items-center justify-center gap-2">
                <Save size={16} /> {loading ? "Saving..." : "Save Route"}
              </button>
            </div>
          )}

          {selectedRoute && (
            <div className="space-y-4">
              {loading && <Loader size="sm" />}
              <div className="flex items-center justify-between">
                <h3 className="glass-section-title text-lg truncate">{selectedRoute.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDeleteRoute(selectedRoute)}
                    className="text-xs font-medium text-red-400 hover:text-red-500 flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                  <button onClick={() => setSelectedRoute(null)} className="text-xs font-medium text-slate-400 hover:text-slate-600">Close</button>
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <label className="glass-label">Route details</label>
                <input aria-label="Route name" value={routeMetadataDraft.name} onChange={(e) => setRouteMetadataDraft((v) => ({ ...v, name: e.target.value }))} className="glass-input w-full" placeholder="Route name" />
                <div className="grid grid-cols-2 gap-2">
                  <input aria-label="Route code" value={routeMetadataDraft.route_code} onChange={(e) => setRouteMetadataDraft((v) => ({ ...v, route_code: e.target.value }))} className="glass-input w-full" placeholder="Route code" />
                  <input aria-label="Direction name" value={routeMetadataDraft.direction_name} onChange={(e) => setRouteMetadataDraft((v) => ({ ...v, direction_name: e.target.value }))} className="glass-input w-full" placeholder="Direction" />
                </div>
                <button onClick={saveRouteMetadata} className="glass-btn-secondary w-full py-2">Save route details</button>
              </div>
              <p className="text-sm text-slate-500">{selectedRoute.start_name} → {selectedRoute.end_name}</p>
              <div className="glass-card-subtle rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="glass-label">Global stop sequence</label>
                  <span className="text-[10px] text-slate-500">{selectedRoute.is_public ? "Published" : "Private draft"}</span>
                </div>
                <input value={globalStopQuery} onChange={(e) => setGlobalStopQuery(e.target.value)}
                  placeholder="Search this city's global stops" className="glass-input w-full" />
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">Optionally filter near a location</label>
                  <LocationSearch placeholder="Search geographic area" initialValue={globalStopNearby?.display_name || ""}
                    onSelect={(item) => setGlobalStopNearby(item || null)} className="w-full" />
                  <div className="flex items-center gap-2">
                    <select value={globalStopRadius} onChange={(e) => setGlobalStopRadius(Number(e.target.value))} className="glass-input flex-1">
                      {[1000, 2500, 5000, 10000, 20000].map((radius) => <option key={radius} value={radius}>{radius / 1000} km radius</option>)}
                    </select>
                    {globalStopNearby && <button type="button" className="text-xs text-slate-500" onClick={() => setGlobalStopNearby(null)}>Clear area</button>}
                  </div>
                </div>
                {globalStopResults.map((stop) => (
                  <button key={stop.id} type="button"
                    disabled={routeMembershipDraft.some((item) => item.id === stop.id) || stop.lat == null || stop.lng == null}
                    onClick={() => { setRouteMembershipDraft((rows) => [...rows, { ...stop, location: { type: "Point", coordinates: [stop.lng, stop.lat] } }]); setGlobalStopQuery(""); setGlobalStopResults([]); }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-white disabled:opacity-40">
                    {stop.name} · {Number(stop.lat).toFixed(5)}, {Number(stop.lng).toFixed(5)}{stop.distance_m != null ? ` · ${Math.round(stop.distance_m)} m` : ""}
                  </button>
                ))}
                {routeMembershipDraft.map((stop, index) => (
                  <div key={`${stop.id}-${index}`} className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs">
                    <span className="flex-1 truncate">{index + 1}. {stop.name}<small className="block text-[10px] text-slate-500">{stop.location?.coordinates?.[1]?.toFixed(5)}, {stop.location?.coordinates?.[0]?.toFixed(5)}</small></span>
                    <button type="button" disabled={index === 0} title="Move up" onClick={() => setRouteMembershipDraft((rows) => {
                      const next = [...rows]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next;
                    })}><ArrowUp size={13} /></button>
                    <button type="button" disabled={index === routeMembershipDraft.length - 1} title="Move down" onClick={() => setRouteMembershipDraft((rows) => {
                      const next = [...rows]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next;
                    })}><ArrowDown size={13} /></button>
                    <button type="button" title="Remove stop" onClick={() => setRouteMembershipDraft((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={13} /></button>
                  </div>
                ))}
                <button onClick={saveRouteMemberships} className="glass-btn-primary w-full py-2">Save stop order</button>
                <button onClick={() => setRoutePublished(!selectedRoute.is_public)}
                  disabled={!selectedRoute.is_public && (routeMembershipDraft.length < 2 || membershipDraftChanged)}
                  className="glass-btn-secondary w-full py-2 disabled:opacity-40">
                  {selectedRoute.is_public ? "Unpublish route" : membershipDraftChanged ? "Save stop order to publish" : "Publish route"}
                </button>
              </div>
              {selectedRoute.total_distance_meters && (
                <p className="text-sm font-semibold text-slate-800">{(selectedRoute.total_distance_meters / 1000).toFixed(1)} km</p>
              )}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Stops (drag to reorder on map, click to edit)
                </p>
                {(selectedRoute.stops || []).sort((a, b) => a.order - b.order).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl p-3 group hover:shadow-md transition" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-semibold text-xs" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue)" }}>{s.order}</div>
                    <span className="flex-1 text-sm font-semibold text-slate-800 truncate">{s.name}</span>
                    <button onClick={() => editRouteStop(s)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 opacity-0 group-hover:opacity-100"><Edit3 size={14} /></button>
                    <button onClick={() => deleteRouteStop(s)} className="p-1.5 hover:bg-red-50 rounded text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "import" && !selectedRoute && (
            <div className="space-y-5">
              {importLoading && <Loader size="sm" />}

              <div className="flex items-center gap-1 flex-wrap">
                {["Upload", "Map", "Config", "Save"].map((label, i) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                      importStep > i
                        ? "text-white"
                        : importStep === i
                          ? "text-white"
                          : "text-slate-400"
                    }`}
                      style={{
                        background: importStep > i || importStep === i
                          ? "linear-gradient(135deg, var(--accent-blue), var(--accent-blue-light))"
                          : "rgba(148,163,184,0.12)",
                        boxShadow: importStep === i ? "0 0 0 3px rgb(var(--accent-blue-rgb) / 0.15)" : undefined,
                      }}>
                      {importStep > i ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold ${importStep === i ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                    {i < 3 && <ChevronRight size={10} className="text-slate-300" />}
                  </div>
                ))}
              </div>

              {importError && (
                <div className="rounded-lg px-4 py-3 text-xs text-red-500" style={{ background: "rgba(255,93,93,0.1)", border: "1px solid rgba(255,93,93,0.25)" }}>{importError}</div>
              )}

              {importStep === 0 && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl p-8 text-center cursor-pointer transition"
                    style={{ border: "2px dashed rgb(var(--accent-blue-rgb) / 0.25)", background: "rgba(255,255,255,0.5)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgb(var(--accent-blue-rgb) / 0.5)"; e.currentTarget.style.background = "rgb(var(--accent-blue-rgb) / 0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgb(var(--accent-blue-rgb) / 0.25)"; e.currentTarget.style.background = "rgba(255,255,255,0.5)"; }}
                  >
                    <div className="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.15)" }}>
                      <FileSpreadsheet size={28} style={{ color: "var(--accent-blue)" }} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Click to upload CSV or Excel file</p>
                    <p className="text-[11px] text-slate-400 mt-1">Parsed locally in your browser</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFileUpload} className="hidden" />
                </div>
              )}

              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {importTotalRows} rows found
                    </p>
                    <button onClick={resetImport} className="text-[11px] font-medium text-red-400 hover:text-red-500">Cancel</button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="glass-label mb-1 block">Stop Name *</label>
                      <select value={importMapping.name} onChange={(e) => setImportMapping({ ...importMapping, name: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="glass-label mb-1 block">Latitude *</label>
                      <select value={importMapping.latitude} onChange={(e) => setImportMapping({ ...importMapping, latitude: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="glass-label mb-1 block">Longitude *</label>
                      <select value={importMapping.longitude} onChange={(e) => setImportMapping({ ...importMapping, longitude: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="glass-label mb-1 block">Stop Order</label>
                      <select value={importMapping.order} onChange={(e) => setImportMapping({ ...importMapping, order: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="glass-label mb-1 block">Plus Code</label>
                      <select value={importMapping.plusCode} onChange={(e) => setImportMapping({ ...importMapping, plusCode: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="glass-label mb-1 block">Nearby Landmark</label>
                      <select value={importMapping.nearbyLandmark} onChange={(e) => setImportMapping({ ...importMapping, nearbyLandmark: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="glass-label mb-1 block">Complete Road Path</label>
                      <select value={importMapping.roadPath} onChange={(e) => setImportMapping({ ...importMapping, roadPath: e.target.value })}
                        className="glass-select w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {importRoadPath.length > 0 ? (
                        <p className="text-[10px] text-emerald-500 mt-1 font-medium">
                          {importRoadPath.length.toLocaleString()} road-path geometry points parsed
                        </p>
                      ) : importMapping.roadPath ? (
                        <p className="text-[10px] text-amber-500 mt-1 font-medium">
                          No coordinates found in this column
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {importRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)", background: "rgba(255,255,255,0.6)" }}>
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr style={{ background: "rgb(var(--accent-blue-rgb) / 0.05)" }}>
                            {importColumns.slice(0, 8).map((c) => <th key={c} className="p-2 text-left font-semibold text-slate-500 whitespace-nowrap">{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 3).map((row, i) => (
                            <tr key={i} className="border-t border-slate-200/60">
                              {importColumns.slice(0, 8).map((c) => <td key={c} className="p-2 text-slate-800 whitespace-nowrap">{row[c]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button onClick={() => setImportStep(2)}
                    disabled={!importMapping.latitude || !importMapping.longitude || !importMapping.order || !importMapping.plusCode || !importMapping.nearbyLandmark}
                    className="glass-btn-primary w-full py-3 flex items-center justify-center gap-2">
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="rounded-xl p-3" style={{ background: "rgb(var(--accent-blue-rgb) / 0.06)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)" }}>
                    <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider mb-1">From CSV</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {importRouteCode && <span className="text-slate-800"><span className="font-semibold">Code:</span> {importRouteCode}</span>}
                      {importRouteName && <span className="text-slate-800"><span className="font-semibold">Name:</span> {importRouteName}</span>}
                      <span className="text-slate-800"><span className="font-semibold">Stops:</span> {importPreviewStops.length}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="glass-label">Route Name *</label>
                    <input value={importRouteName} onChange={(e) => setImportRouteName(e.target.value)}
                      placeholder="e.g. Downtown Express"
                      className="glass-input w-full" />
                  </div>
                  <div className="space-y-1">
                    <label className="glass-label">Route Code</label>
                    <input value={importRouteCode} onChange={(e) => setImportRouteCode(e.target.value)}
                      placeholder="e.g. R001"
                      className="glass-input w-full" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Stops ({importPreviewStops.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {importPreviewStops.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg p-2" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)" }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center font-semibold text-[9px] shrink-0" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue)" }}>{i + 1}</div>
                          <span className="text-[11px] font-medium text-slate-800 truncate flex-1">{s.name}</span>
                          <span className="text-[10px] text-slate-400">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setImportStep(1)}
                      className="glass-btn flex-1 py-3 text-sm">
                      Back
                    </button>
                    <button onClick={() => setImportStep(3)}
                      disabled={!importRouteName}
                      className="glass-btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                      Preview Map <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {importStep === 3 && (
                <div className="space-y-4">
                  <div className="rounded-lg p-3" style={{ background: "rgb(var(--accent-blue-rgb) / 0.06)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.18)" }}>
                    <p className="text-xs font-semibold text-slate-800">{importRouteName}</p>
                    <p className="text-[11px] text-slate-500">
                      {importPreviewStops.length} stops | {importPreviewStops[0]?.name} → {importPreviewStops[importPreviewStops.length - 1]?.name}
                    </p>
                  </div>

                  {importRoadPath.length >= 2 ? (
                    <div className="rounded-lg p-3" style={{ background: "rgb(var(--accent-blue-rgb) / 0.06)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.12)" }}>
                      <p className="text-[11px] font-semibold text-slate-800">Road path generated</p>
                      <p className="text-[11px] text-slate-500">
                        {importRoadPath.length} geometry points via OSRM
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg p-3" style={{ background: "rgba(255,176,32,0.10)", border: "1px solid rgba(255,176,32,0.3)" }}>
                      <p className="text-[11px] font-semibold text-slate-800">
                        {importRoadPathError ? "Road path unavailable" : "Generating road path..."}
                      </p>
                      <p role={importRoadPathError ? "alert" : undefined} className="text-[11px] text-slate-500">
                        {importRoadPathError || "Routing via OSRM; the map preview currently joins the supplied stops directly."}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setImportStep(2)}
                      className="glass-btn flex-1 py-3 text-sm">
                      Back
                    </button>
                    <button onClick={handleGenerateRoadPath}
                      className="glass-btn px-3 py-3 text-sm">
                      <RefreshCw size={14} />
                    </button>
                    <button onClick={handleImportSave}
                      disabled={importLoading || !selectedCity || !importRouteName || importPreviewStops.length < 2}
                      className="glass-btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                      <Save size={16} /> {importLoading ? "Routing via OSRM..." : "Import Route"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainer} className="h-full w-full" />
        <div className="absolute top-5 right-5 flex flex-col gap-2 z-10">
          <div className="glass-card-subtle p-2 rounded-xl flex flex-col gap-1" style={{ boxShadow: "0 8px 24px rgba(31,38,135,0.1)" }}>
            <button onClick={() => map.current?.zoomIn()} className="w-9 h-9 hover:bg-white/70 rounded-lg flex items-center justify-center text-slate-700"><Plus size={18} /></button>
            <button onClick={() => map.current?.zoomOut()} className="w-9 h-9 hover:bg-white/70 rounded-lg flex items-center justify-center text-slate-700"><ArrowDown size={18} /></button>
            <button onClick={toggle3D} className={`w-9 h-9 rounded-lg flex items-center justify-center ${is3D ? "text-[#2E5CFF]" : "hover:bg-white/70 text-slate-700"}`} style={is3D ? { background: "rgb(var(--accent-blue-rgb) / 0.1)" } : {}}><Box size={18} /></button>
            <button onClick={resetView} className={`w-9 h-9 rounded-lg flex items-center justify-center ${Math.abs(pitch) > 1 ? "text-[#2E5CFF]" : "hover:bg-white/70 text-slate-700"}`} style={Math.abs(pitch) > 1 ? { background: "rgb(var(--accent-blue-rgb) / 0.1)" } : {}}><Compass size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
