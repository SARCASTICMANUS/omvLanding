import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../api/client";
import LocationSearch from "../components/LocationSearch";
import {
  Plus, Save, Trash2, XCircle,
  ArrowUp, ArrowDown, Bike, Compass, Box, Edit3,
  Route as RouteIcon,
} from "lucide-react";

const DEFAULT_CENTER = [78.9629, 20.5937];
const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const geoJsonify = (coords) => ({
  type: "FeatureCollection",
  features: coords.length
    ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }]
    : [],
});

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

  useEffect(() => { api.get("/transport/cities/").then((r) => {
    const d = Array.isArray(r.data) ? r.data : r.data.results || [];
    setCities(d);
    if (d.length) setSelectedCity(d[0].id);
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
      zoom: 5,
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
        el.className = "flex items-center justify-center bg-brand-600 text-white w-7 h-7 rounded-full border-2 border-white shadow-md text-[11px] font-bold";
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
      el.className = "w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow-lg cursor-grab";
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
      el.className = "w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-lg cursor-grab";
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
      el.className = "flex items-center justify-center bg-indigo-600 text-white w-6 h-6 rounded-full border-2 border-white shadow-md text-[10px] font-bold cursor-grab";
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

  const endStopCount = (start ? 1 : 0) + (end ? 1 : 0);

  return (
    <div className="flex h-full">
      <div className="w-[420px] bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 bg-slate-900 text-white space-y-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <RouteIcon className="text-brand-400" size={20} /> Route Manager
          </h2>
          <select
            value={selectedCity}
            onChange={(e) => { setSelectedCity(e.target.value); resetForm(); }}
            className="w-full bg-slate-800 text-white text-sm rounded-lg p-3 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Select City</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="px-5 py-3 border-b border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => { setTab("library"); setSelectedRoute(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === "library" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}>Routes</button>
            <button onClick={() => { setTab("create"); setSelectedRoute(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                tab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}>Create</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "library" && (
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{routes.length} routes</p>
              {routes.map((r) => (
                <div key={r.id} className={`group rounded-xl border overflow-hidden transition ${
                  selectedRoute?.id === r.id ? "border-brand-300 shadow-lg" : "border-slate-100 hover:shadow-md"
                }`}>
                  <div className="flex items-stretch">
                    <button onClick={() => { fetchRouteDetail(r); setTab("library"); }}
                      className="flex-1 p-4 text-left flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                        <Bike size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-slate-900 truncate">{r.name}</h4>
                        <p className="text-[11px] text-slate-400 font-medium">{r.start_name} → {r.end_name}</p>
                        <div className="flex gap-2 mt-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {r.total_distance_meters ? `${(r.total_distance_meters / 1000).toFixed(1)} km` : "N/A"}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.is_public ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                          }`}>{r.is_public ? "Public" : "Private"}</span>
                        </div>
                      </div>
                    </button>
                    <button onClick={() => handleDeleteRoute(r)}
                      className="px-3 flex items-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
              {routes.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">No routes yet</p>}
            </div>
          )}

          {tab === "create" && !selectedRoute && (
            <div className="space-y-5">
              {previews.length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Path Alternatives ({previews.length})
                  </p>
                  <div className="grid gap-2">
                    {previews.map((p, i) => (
                      <button key={i} onClick={() => setSelectedPreview(i)}
                        className={`p-3 rounded-xl border text-left transition ${
                          i === selectedPreview ? "border-brand-500 bg-brand-50" : "border-slate-200"
                        }`}>
                        <p className="text-xs font-bold text-slate-700">
                          Option {i + 1}: {(p.distance / 1000).toFixed(1)} km, {Math.round(p.duration / 60)} min
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Route Name</label>
                <input value={routeName} onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Downtown Express"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none" />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-12 bg-emerald-300 rounded-full shrink-0" />
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
                  <div className="w-1 h-12 bg-red-300 rounded-full shrink-0" />
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
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Stops ({stops.length + endStopCount})
                  </p>
                  <button onClick={() => setIsAddingStop(!isAddingStop)}
                    disabled={!start || !end}
                    className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full transition ${
                      !start || !end ? "bg-slate-100 text-slate-400 cursor-not-allowed" :
                      isAddingStop ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                    }`}>
                    {isAddingStop ? <XCircle size={14} /> : <Plus size={14} />}
                    {isAddingStop ? "Cancel" : "Add Stop"}
                  </button>
                </div>

                {isAddingStop && <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-700 animate-pulse">Click on the map to place a stop.</div>}

                {start && (
                  <div className="flex items-center gap-3 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">1</div>
                    <span className="text-sm font-semibold text-slate-700 truncate">{startName || "Origin"}</span>
                  </div>
                )}

                {stops.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-100 group hover:shadow-sm transition">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">{i + 2}</div>
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
                  <div className="flex items-center gap-3 bg-red-50 p-3 rounded-xl border border-red-100">
                    <div className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold text-xs">{stops.length + 2}</div>
                    <span className="text-sm font-semibold text-slate-700 truncate">{endName || "Destination"}</span>
                  </div>
                )}
              </div>

              <button onClick={saveRoute} disabled={!end || loading}
                className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition disabled:opacity-50 shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2">
                <Save size={16} /> {loading ? "Saving..." : "Save Route"}
              </button>
            </div>
          )}

          {selectedRoute && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg text-slate-800">{selectedRoute.name}</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDeleteRoute(selectedRoute)}
                    className="text-xs font-bold text-red-400 hover:text-red-600 flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                  <button onClick={() => setSelectedRoute(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Close</button>
                </div>
              </div>
              <p className="text-sm text-slate-500">{selectedRoute.start_name} → {selectedRoute.end_name}</p>
              {selectedRoute.total_distance_meters && (
                <p className="text-sm font-bold text-slate-600">{(selectedRoute.total_distance_meters / 1000).toFixed(1)} km</p>
              )}
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Stops (drag to reorder on map, click to edit)
                </p>
                {(selectedRoute.stops || []).sort((a, b) => a.order - b.order).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 group hover:shadow-sm transition">
                    <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">{s.order}</div>
                    <span className="flex-1 text-sm font-semibold text-slate-700">{s.name}</span>
                    <button onClick={() => editRouteStop(s)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 opacity-0 group-hover:opacity-100"><Edit3 size={14} /></button>
                    <button onClick={() => deleteRouteStop(s)} className="p-1.5 hover:bg-red-50 rounded text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainer} className="h-full w-full" />
        <div className="absolute top-5 right-5 flex flex-col gap-2 z-10">
          <div className="bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-xl border flex flex-col gap-1">
            <button onClick={() => map.current?.zoomIn()} className="w-9 h-9 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-600"><Plus size={18} /></button>
            <button onClick={() => map.current?.zoomOut()} className="w-9 h-9 hover:bg-slate-100 rounded-xl flex items-center justify-center text-slate-600"><ArrowDown size={18} /></button>
            <button onClick={toggle3D} className={`w-9 h-9 rounded-xl flex items-center justify-center ${is3D ? "bg-brand-600 text-white" : "hover:bg-slate-100 text-slate-600"}`}><Box size={18} /></button>
            <button onClick={resetView} className={`w-9 h-9 rounded-xl flex items-center justify-center ${Math.abs(pitch) > 1 ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-600"}`}><Compass size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
