import { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as XLSX from "xlsx";
import api from "../api/client";
import LocationSearch from "../components/LocationSearch";
import EmptyState from "../components/EmptyState";
import Loader from "../components/Loader";
import { ROUTE_COLORS } from "../colors";
import {
  Plus, Save, Trash2, XCircle,
  ArrowUp, ArrowDown, Bike, Compass, Box, Edit3,
  Route as RouteIcon, Upload, FileSpreadsheet, ChevronRight, Check, RefreshCw,
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

  const [cities, setCities] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [tab, setTab] = useState("library");
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [expandedRoute, setExpandedRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [stops, setStops] = useState([]);
  const [routeName, setRouteName] = useState("");
  const [startName, setStartName] = useState("");
  const [endName, setEndName] = useState("");
  const [isAddingStop, setIsAddingStop] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [selectedPreview, setSelectedPreview] = useState(0);

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

  const fetchRouteDetail = async (route) => {
    try {
      const res = await api.get(`/transport/routes/${route.id}/`);
      setSelectedRoute(res.data);
    } catch { setSelectedRoute(route); }
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
        paint: { "line-color": "#009849", "line-width": 6, "line-opacity": 0.9 },
      });
      setMapLoaded(true);
    });

    map.current.on("moveend", () => {
      setPitch(map.current.getPitch());
      setBearing(map.current.getBearing());
    });
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
        const s = { lat, lon: lng, name: `Stop ${curStops.length + 1}` };
        const updated = [...curStops, s];
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
    } catch { /* ignore */ }
  };

  const fetchPreview = async (s, e, st, sn, en) => {
    if (!s || !e) return;
    try {
      const res = await api.post("/transport/routes/preview/", {
        start: { lat: s.lat, lon: s.lon, name: sn || "" },
        end: { lat: e.lat, lon: e.lon, name: en || "" },
        stops: (st || []).map((s, i) => ({ lat: s.lat, lon: s.lon, name: s.name, order: i })),
      });
      setPreviews(Array.isArray(res.data) ? res.data : []);
      setSelectedPreview(0);
    } catch { setPreviews([]); }
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
      const src = m.getSource("route-path");
      if (src) src.setData(geoJsonify(path));

      if (path.length) {
        const bounds = path.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(path[0], path[0]));
        m.fitBounds(bounds, { padding: 80, duration: 1000 });
      }

      (route.stops || []).forEach((s, i) => {
        const coords = s.location?.coordinates || [];
        if (coords.length < 2) return;
        const el = document.createElement("div");
        el.className = "flex items-center justify-center bg-memphis-pink text-memphis-ink w-7 h-7 rounded-full border-2 border-memphis-paper shadow-memphis text-[11px] font-bold";
        el.innerHTML = i + 1;
        const mk = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat(coords)
          .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
          .addTo(m);
        mk.on("dragend", async () => {
          const pos = mk.getLngLat();
          const newCoords = [pos.lng, pos.lat];
          s.location.coordinates = newCoords;
          await api.patch(`/transport/stops/${s.id}/`, {
            location: { type: "Point", coordinates: newCoords },
          });
        });
        markers.current[`s-${i}`] = mk;
      });
      return;
    }

    if (start) {
      const el = document.createElement("div");
      el.className = "w-5 h-5 bg-memphis-mint rounded-full border-2 border-memphis-paper shadow-memphis-lg cursor-grab";
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
      el.className = "w-5 h-5 bg-memphis-coral rounded-full border-2 border-memphis-paper shadow-memphis-lg cursor-grab";
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
      el.className = "flex items-center justify-center bg-memphis-purple text-white w-6 h-6 rounded-full border-2 border-memphis-paper shadow-memphis text-[10px] font-bold cursor-grab";
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
  }, [start, end, stops, selectedRoute, mapLoaded]);

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
    const preview = previews[selectedPreview];
    const pathCoords = preview?.path || [[end.lon, end.lat], [start.lon, start.lat]];
    try {
      const res = await api.post("/transport/routes/", {
        city: selectedCity,
        name: routeName || "New Route",
        start_name: startName,
        end_name: endName,
        path: { type: "LineString", coordinates: pathCoords },
        total_distance_meters: preview?.distance || 0,
      });
      const routeId = res.data.id;
      const allStops = [
        { name: startName || "Start", location: { type: "Point", coordinates: [start.lon, start.lat] }, order: 0 },
        ...stops.map((s, i) => ({ name: s.name, location: { type: "Point", coordinates: [s.lon, s.lat] }, order: i + 1 })),
        { name: endName || "End", location: { type: "Point", coordinates: [end.lon, end.lat] }, order: stops.length + 1 },
      ];
      for (const s of allStops) {
        await api.post("/transport/stops/", { ...s, route: routeId });
      }
      resetForm();
      api.get(`/transport/routes/?city_id=${selectedCity}`).then((r) => {
        setRoutes(Array.isArray(r.data) ? r.data : r.data.results || []);
      });
    } catch (err) {
      alert("Failed to save route: " + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  const resetForm = () => {
    setStart(null); setEnd(null); setStops([]);
    setRouteName(""); setStartName(""); setEndName("");
    setPreviews([]); setSelectedPreview(0);
    setSelectedRoute(null);
    startRef.current = null; endRef.current = null; stopsRef.current = [];
    startNameRef.current = ""; endNameRef.current = "";
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
      await api.patch(`/transport/stops/${stop.id}/`, { name: newName });
      fetchRouteDetail(selectedRoute);
    }
  };

  const deleteRouteStop = async (stop) => {
    if (!window.confirm(`Delete stop "${stop.name}"?`)) return;
    await api.delete(`/transport/stops/${stop.id}/`);
    fetchRouteDetail(selectedRoute);
  };

  const handleDeleteRoute = async (route) => {
    if (!window.confirm(`Delete route "${route.name}"? This will also delete all its stops.`)) return;
    try {
      await api.delete(`/transport/routes/${route.id}/`);
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
      const name = importMapping.name ? (row[importMapping.name] || `Stop ${order}`) : `Stop ${order}`;
      const plusCode = importMapping.plusCode ? (row[importMapping.plusCode] || "") : "";
      const nearbyLandmark = importMapping.nearbyLandmark ? (row[importMapping.nearbyLandmark] || "") : "";
      stops.push({ lat, lon, name, order, plus_code: plusCode, nearby_landmark: nearbyLandmark });
    });
    stops.sort((a, b) => a.order - b.order);
    setImportPreviewStops(stops);

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
  }, [importRows, importMapping]);

  const handleGenerateRoadPath = useCallback(async () => {
    if (importPreviewStops.length < 2) return;
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
      }
    } catch (err) {
      console.warn("Road path generation failed, using straight-line preview:", err);
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
      el.className = "flex items-center justify-center bg-memphis-pink text-memphis-ink w-7 h-7 rounded-full border-2 border-memphis-paper shadow-memphis text-[11px] font-bold";
      el.innerHTML = i + 1;
      const mk = new maplibregl.Marker({ element: el })
        .setLngLat([s.lon, s.lat])
        .setPopup(new maplibregl.Popup({ offset: 15 }).setText(s.name))
        .addTo(m);
      markers.current[`import-${i}`] = mk;
    });
  }, [importStep, importPreviewStops, importRoadPath, mapLoaded]);

  const handleImportSave = async () => {
    if (!selectedCity || !importRouteName || importPreviewStops.length < 2) return;
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
      const extra = d.road_snapped ? `\nRoad-snapped: ${d.geometry_points} geometry points` : "";
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

  return (
    <div className="flex h-full">
      <div className="w-[420px] bg-memphis-paper border-r-2 border-memphis-ink flex flex-col shrink-0">
        <div className="p-5 bg-memphis-ink text-memphis-paper space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2" style={{ fontFamily: '"Archivo Black, sans-serif"' }}>
            <RouteIcon className="text-memphis-pink" size={20} /> Route Manager
          </h2>
          <select
            value={selectedCity}
            onChange={(e) => { setSelectedCity(e.target.value); resetForm(); zoomToCity(e.target.value); }}
            className="w-full bg-memphis-ink text-memphis-paper text-sm rounded-xl p-3 border-2 border-memphis-purple outline-none focus:ring-2 focus:ring-memphis-pink memphis-input"
          >
            <option value="">Select City</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="px-5 py-3 border-b-2 border-memphis-ink/10">
          <div className="bg-memphis-ink/5 p-1.5 border-2 border-memphis-ink rounded-lg flex">
            <button onClick={() => { setTab("library"); setSelectedRoute(null); resetImport(); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === "library" ? "bg-memphis-pink text-memphis-ink shadow-memphis" : "text-memphis-purple hover:text-memphis-ink"
              }`}>Routes</button>
            <button onClick={() => { setTab("create"); setSelectedRoute(null); resetImport(); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === "create" ? "bg-memphis-yellow text-memphis-ink shadow-memphis" : "text-memphis-purple hover:text-memphis-ink"
              }`}>Create</button>
            <button onClick={() => { setTab("import"); setSelectedRoute(null); resetForm(); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === "import" ? "bg-memphis-teal text-memphis-ink shadow-memphis" : "text-memphis-purple hover:text-memphis-ink"
              }`}>Import</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "library" && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-memphis-purple/50 uppercase tracking-wider">{routes.length} routes</p>
              {routes.map((r) => (
                <div key={r.id} className={`group memphis-card overflow-hidden transition ${
                  selectedRoute?.id === r.id ? "border-memphis-pink border-l-[6px] shadow-memphis-lg" : "hover:shadow-memphis"
                }`}>
                  <div className="flex items-stretch">
                    <button onClick={() => { fetchRouteDetail(r); setTab("library"); }}
                      className="flex-1 p-4 text-left flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-memphis-teal/20 text-memphis-teal flex items-center justify-center shrink-0">
                        <Bike size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-memphis-ink truncate">{r.name}</h4>
                        <p className="text-[11px] text-memphis-purple/50 font-medium">{r.start_name} → {r.end_name}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-memphis-ink/5 text-memphis-purple">
                            {r.total_distance_meters ? `${(r.total_distance_meters / 1000).toFixed(1)} km` : "N/A"}
                          </span>
                          {r.stops_count > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-memphis-pink/15 text-memphis-pink">
                              {r.stops_count} stops
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.is_public ? "bg-memphis-mint/20 text-memphis-mint" : "bg-memphis-ink/5 text-memphis-purple/40"
                          }`}>{r.is_public ? "Public" : "Private"}</span>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => handleDeleteRoute(r)}
                      className="px-3 flex items-center text-memphis-purple/30 hover:text-memphis-coral hover:bg-memphis-coral/10 transition opacity-0 group-hover:opacity-100">
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

              {previews.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-memphis-purple/50 uppercase tracking-wider">
                    Path Alternatives ({previews.length})
                  </p>
                  <div className="grid gap-2">
                    {previews.map((p, i) => (
                      <button key={i} onClick={() => setSelectedPreview(i)}
                        className={`p-3 rounded-xl border-2 text-left transition ${
                          i === selectedPreview ? "border-memphis-pink bg-memphis-pink/10" : "border-memphis-ink/10 hover:border-memphis-purple/30"
                        }`}>
                        <p className="text-xs font-bold text-memphis-ink">
                          Option {i + 1}: {(p.distance / 1000).toFixed(1)} km, {Math.round(p.duration / 60)} min
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="memphis-label">Route Name</label>
                <input value={routeName} onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Downtown Express"
                  className="memphis-input w-full" />
              </div>

              <div className="bg-memphis-ink/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-12 bg-memphis-mint rounded-full shrink-0" />
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
                  <div className="w-1 h-12 bg-memphis-coral rounded-full shrink-0" />
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
                  <p className="text-[11px] font-bold text-memphis-purple/50 uppercase tracking-wider">
                    Stops ({stops.length + endStopCount})
                  </p>
                  <button onClick={() => setIsAddingStop(!isAddingStop)}
                    disabled={!start || !end}
                    className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full transition ${
                      !start || !end ? "bg-memphis-ink/5 text-memphis-purple/30 cursor-not-allowed" :
                      isAddingStop ? "bg-memphis-coral/15 text-memphis-coral" : "bg-memphis-purple/15 text-memphis-purple"
                    }`}>
                    {isAddingStop ? <XCircle size={14} /> : <Plus size={14} />}
                    {isAddingStop ? "Cancel" : "Add Stop"}
                  </button>
                </div>

                {isAddingStop && <div className="bg-memphis-yellow/15 border-2 border-memphis-yellow p-3 rounded-lg text-xs text-memphis-ink animate-pulse">Click on the map to place a stop.</div>}

                {start && (
                  <div className="flex items-center gap-3 bg-memphis-mint/15 p-3 rounded-xl border-2 border-memphis-mint/30">
                    <div className="w-7 h-7 rounded-lg bg-memphis-mint text-memphis-ink flex items-center justify-center font-bold text-xs">1</div>
                    <span className="text-sm font-semibold text-memphis-ink truncate">{startName || "Origin"}</span>
                  </div>
                )}

                {stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-memphis-paper p-2.5 rounded-xl border-2 border-memphis-ink/10 group hover:shadow-memphis transition">
                    <div className="w-7 h-7 rounded-lg bg-memphis-purple/10 text-memphis-purple flex items-center justify-center font-bold text-xs shrink-0">{i + 2}</div>
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
                    <button onClick={() => reorderStop(i, -1)} className="p-1 hover:bg-memphis-ink/5 rounded text-memphis-purple/40 shrink-0"><ArrowUp size={14} /></button>
                    <button onClick={() => reorderStop(i, 1)} className="p-1 hover:bg-memphis-ink/5 rounded text-memphis-purple/40 shrink-0"><ArrowDown size={14} /></button>
                    <button onClick={() => {
                      const filtered = stops.filter((_, idx) => idx !== i);
                      setStops(filtered);
                      stopsRef.current = filtered;
                      fetchPreview(start, end, filtered, startName, endName);
                    }} className="p-1 hover:bg-memphis-coral/10 rounded text-memphis-coral/60 shrink-0"><Trash2 size={14} /></button>
                  </div>
                ))}

                {end && (
                  <div className="flex items-center gap-3 bg-memphis-coral/10 p-3 rounded-xl border-2 border-memphis-coral/30">
                    <div className="w-7 h-7 rounded-lg bg-memphis-coral text-white flex items-center justify-center font-bold text-xs">{stops.length + 2}</div>
                    <span className="text-sm font-semibold text-memphis-ink truncate">{endName || "Destination"}</span>
                  </div>
                )}
              </div>

              <button onClick={saveRoute} disabled={!end || loading}
                className="memphis-btn-primary w-full py-4 flex items-center justify-center gap-2">
                <Save size={16} /> {loading ? "Saving..." : "Save Route"}
              </button>
            </div>
          )}

          {selectedRoute && (
            <div className="space-y-4">
              {loading && <Loader size="sm" />}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-memphis-ink" style={{ fontFamily: '"Archivo Black, sans-serif"' }}>{selectedRoute.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDeleteRoute(selectedRoute)}
                    className="text-xs font-bold text-memphis-coral/60 hover:text-memphis-coral flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                  <button onClick={() => setSelectedRoute(null)} className="text-xs font-bold text-memphis-purple/40 hover:text-memphis-purple">Close</button>
                </div>
              </div>
              <p className="text-sm text-memphis-purple/60">{selectedRoute.start_name} → {selectedRoute.end_name}</p>
              {selectedRoute.total_distance_meters && (
                <p className="text-sm font-bold text-memphis-ink">{(selectedRoute.total_distance_meters / 1000).toFixed(1)} km</p>
              )}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-memphis-purple/50 uppercase tracking-wider">
                  Stops (drag to reorder on map, click to edit)
                </p>
                {(selectedRoute.stops || []).sort((a, b) => a.order - b.order).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 bg-memphis-paper p-3 rounded-xl border-2 border-memphis-ink/10 group hover:shadow-memphis transition">
                    <div className="w-7 h-7 rounded-lg bg-memphis-pink/15 text-memphis-pink flex items-center justify-center font-bold text-xs">{s.order}</div>
                    <span className="flex-1 text-sm font-semibold text-memphis-ink">{s.name}</span>
                    <button onClick={() => editRouteStop(s)} className="p-1.5 hover:bg-memphis-ink/5 rounded text-memphis-purple/40 opacity-0 group-hover:opacity-100"><Edit3 size={14} /></button>
                    <button onClick={() => deleteRouteStop(s)} className="p-1.5 hover:bg-memphis-coral/10 rounded text-memphis-coral/60 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
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
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      importStep > i ? "bg-memphis-pink text-memphis-ink" :
                      importStep === i ? "bg-memphis-yellow/20 text-memphis-ink border-2 border-memphis-yellow" :
                      "bg-memphis-ink/5 text-memphis-purple/30"
                    }`}>
                      {importStep > i ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-bold ${importStep === i ? "text-memphis-ink" : "text-memphis-purple/30"}`}>{label}</span>
                    {i < 3 && <ChevronRight size={10} className="text-memphis-ink/20" />}
                  </div>
                ))}
              </div>

              {importError && (
                <div className="bg-memphis-coral/10 border-2 border-memphis-coral/30 p-3 rounded-lg text-xs text-memphis-coral">{importError}</div>
              )}

              {importStep === 0 && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-memphis-ink/20 rounded-xl p-8 text-center cursor-pointer hover:border-memphis-pink hover:bg-memphis-pink/5 transition"
                  >
                    <FileSpreadsheet size={32} className="mx-auto text-memphis-purple/30 mb-3" />
                    <p className="text-sm font-bold text-memphis-ink">Click to upload CSV or Excel file</p>
                    <p className="text-[11px] text-memphis-purple/40 mt-1">Parsed locally in your browser</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImportFileUpload} className="hidden" />
                </div>
              )}

              {importStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-memphis-purple/50 uppercase tracking-wider">
                      {importTotalRows} rows found
                    </p>
                    <button onClick={resetImport} className="text-[11px] font-bold text-memphis-coral/60 hover:text-memphis-coral">Cancel</button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="memphis-label mb-1 block">Stop Name *</label>
                      <select value={importMapping.name} onChange={(e) => setImportMapping({ ...importMapping, name: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="memphis-label mb-1 block">Latitude *</label>
                      <select value={importMapping.latitude} onChange={(e) => setImportMapping({ ...importMapping, latitude: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="memphis-label mb-1 block">Longitude *</label>
                      <select value={importMapping.longitude} onChange={(e) => setImportMapping({ ...importMapping, longitude: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="memphis-label mb-1 block">Stop Order</label>
                      <select value={importMapping.order} onChange={(e) => setImportMapping({ ...importMapping, order: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="memphis-label mb-1 block">Plus Code</label>
                      <select value={importMapping.plusCode} onChange={(e) => setImportMapping({ ...importMapping, plusCode: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="memphis-label mb-1 block">Nearby Landmark</label>
                      <select value={importMapping.nearbyLandmark} onChange={(e) => setImportMapping({ ...importMapping, nearbyLandmark: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="memphis-label mb-1 block">Complete Road Path</label>
                      <select value={importMapping.roadPath} onChange={(e) => setImportMapping({ ...importMapping, roadPath: e.target.value })}
                        className="memphis-input w-full">
                        <option value="">-- Select column (optional) --</option>
                        {importColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {importRoadPath.length > 0 ? (
                        <p className="text-[10px] text-memphis-mint mt-1 font-medium">
                          {importRoadPath.length.toLocaleString()} road-path geometry points parsed
                        </p>
                      ) : importMapping.roadPath ? (
                        <p className="text-[10px] text-memphis-yellow mt-1 font-medium">
                          No coordinates found in this column
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {importRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border-2 border-memphis-ink/10">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-memphis-ink/5">
                            {importColumns.slice(0, 8).map((c) => <th key={c} className="p-2 text-left font-bold text-memphis-purple whitespace-nowrap">{c}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.slice(0, 3).map((row, i) => (
                            <tr key={i} className="border-t border-memphis-ink/10">
                              {importColumns.slice(0, 8).map((c) => <td key={c} className="p-2 text-memphis-ink whitespace-nowrap">{row[c]}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <button onClick={() => setImportStep(2)}
                    disabled={!importMapping.latitude || !importMapping.longitude || !importMapping.order || !importMapping.plusCode || !importMapping.nearbyLandmark}
                    className="memphis-btn-primary w-full py-3 flex items-center justify-center gap-2">
                    Continue <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {importStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-memphis-mint/15 border-2 border-memphis-mint/30 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-memphis-ink uppercase tracking-wider mb-1">From CSV</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {importRouteCode && <span className="text-memphis-ink"><span className="font-bold">Code:</span> {importRouteCode}</span>}
                      {importRouteName && <span className="text-memphis-ink"><span className="font-bold">Name:</span> {importRouteName}</span>}
                      <span className="text-memphis-ink"><span className="font-bold">Stops:</span> {importPreviewStops.length}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="memphis-label">Route Name *</label>
                    <input value={importRouteName} onChange={(e) => setImportRouteName(e.target.value)}
                      placeholder="e.g. Downtown Express"
                      className="memphis-input w-full" />
                  </div>
                  <div className="space-y-1">
                    <label className="memphis-label">Route Code</label>
                    <input value={importRouteCode} onChange={(e) => setImportRouteCode(e.target.value)}
                      placeholder="e.g. R001"
                      className="memphis-input w-full" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-memphis-purple/50 uppercase tracking-wider">
                      Stops ({importPreviewStops.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {importPreviewStops.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 bg-memphis-paper p-2 rounded-lg border-2 border-memphis-ink/10">
                          <div className="w-5 h-5 rounded bg-memphis-pink/15 text-memphis-pink flex items-center justify-center font-bold text-[9px] shrink-0">{i + 1}</div>
                          <span className="text-[11px] font-medium text-memphis-ink truncate flex-1">{s.name}</span>
                          <span className="text-[10px] text-memphis-purple/40">{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setImportStep(1)}
                      className="memphis-btn flex-1 py-3 text-sm">
                      Back
                    </button>
                    <button onClick={() => setImportStep(3)}
                      disabled={!importRouteName}
                      className="memphis-btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                      Preview Map <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {importStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-memphis-teal/15 border-2 border-memphis-teal/30 p-3 rounded-lg">
                    <p className="text-xs font-bold text-memphis-ink">{importRouteName}</p>
                    <p className="text-[11px] text-memphis-purple">
                      {importPreviewStops.length} stops | {importPreviewStops[0]?.name} → {importPreviewStops[importPreviewStops.length - 1]?.name}
                    </p>
                  </div>

                  {importRoadPath.length >= 2 ? (
                    <div className="bg-memphis-mint/15 border-2 border-memphis-mint/30 p-3 rounded-lg">
                      <p className="text-[11px] font-bold text-memphis-ink">Road path generated</p>
                      <p className="text-[11px] text-memphis-purple">
                        {importRoadPath.length} geometry points via OSRM
                      </p>
                    </div>
                  ) : (
                    <div className="bg-memphis-yellow/15 border-2 border-memphis-yellow/30 p-3 rounded-lg">
                      <p className="text-[11px] font-bold text-memphis-ink">Generating road path...</p>
                      <p className="text-[11px] text-memphis-purple">
                        Routing via OSRM. Fallback: straight line between stops.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setImportStep(2)}
                      className="memphis-btn flex-1 py-3 text-sm">
                      Back
                    </button>
                    <button onClick={handleGenerateRoadPath}
                      className="memphis-btn px-3 py-3 text-sm">
                      <RefreshCw size={14} />
                    </button>
                    <button onClick={handleImportSave} disabled={importLoading || !selectedCity}
                      className="memphis-btn-primary flex-1 py-3 flex items-center justify-center gap-2">
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
          <div className="bg-memphis-paper/90 backdrop-blur-md p-2 rounded-xl shadow-memphis-lg border-2 border-memphis-ink flex flex-col gap-1">
            <button onClick={() => map.current?.zoomIn()} className="w-9 h-9 hover:bg-memphis-ink/5 rounded-lg flex items-center justify-center text-memphis-ink"><Plus size={18} /></button>
            <button onClick={() => map.current?.zoomOut()} className="w-9 h-9 hover:bg-memphis-ink/5 rounded-lg flex items-center justify-center text-memphis-ink"><ArrowDown size={18} /></button>
            <button onClick={toggle3D} className={`w-9 h-9 rounded-lg flex items-center justify-center ${is3D ? "bg-memphis-pink text-memphis-ink" : "hover:bg-memphis-ink/5 text-memphis-ink"}`}><Box size={18} /></button>
            <button onClick={resetView} className={`w-9 h-9 rounded-lg flex items-center justify-center ${Math.abs(pitch) > 1 ? "bg-memphis-ink text-memphis-paper" : "hover:bg-memphis-ink/5 text-memphis-ink"}`}><Compass size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
