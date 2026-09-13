import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Bike, MapPin, ChevronDown, Route as RouteIcon, ArrowLeft, Navigation, Edit3, Save, Trash2, Plus } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../api/client";

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const ROUTE_COLORS = [
  { line: "#16a34a", bg: "#dcfce7", text: "#15803d", dot: "#22c55e" },
  { line: "#2563eb", bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6" },
  { line: "#9333ea", bg: "#f3e8ff", text: "#7e22ce", dot: "#a855f7" },
  { line: "#ea580c", bg: "#fff7ed", text: "#c2410c", dot: "#f97316" },
  { line: "#e11d48", bg: "#fff1f2", text: "#be123c", dot: "#f43f5e" },
  { line: "#0891b2", bg: "#ecfeff", text: "#0e7490", dot: "#06b6d4" },
  { line: "#4f46e5", bg: "#eef2ff", text: "#4338ca", dot: "#6366f1" },
  { line: "#ca8a04", bg: "#fefce8", text: "#a16207", dot: "#eab308" },
  { line: "#059669", bg: "#ecfdf5", text: "#047857", dot: "#10b981" },
  { line: "#dc2626", bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
  { line: "#7c3aed", bg: "#f5f3ff", text: "#6d28d9", dot: "#8b5cf6" },
  { line: "#0284c7", bg: "#f0f9ff", text: "#0369a1", dot: "#0ea5e9" },
  { line: "#d946ef", bg: "#fdf4ff", text: "#a21caf", dot: "#d946ef" },
  { line: "#65a30d", bg: "#f7fee7", text: "#4d7c0f", dot: "#84cc16" },
];

function getRouteColor(idx) {
  return ROUTE_COLORS[idx % ROUTE_COLORS.length];
}

function RoutePolyline({ coordinates, color = "#16a34a", width = 400, height = 80 }) {
  if (!coordinates || coordinates.length < 2) {
    return (
      <div className="w-full h-20 bg-slate-50 rounded-xl flex items-center justify-center">
        <span className="text-xs text-slate-300 font-medium">No path data</span>
      </div>
    );
  }

  const lons = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const pad = 12;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const scale = Math.min(w / (maxLon - minLon || 1), h / (maxLat - minLat || 1));

  const points = coordinates.map((c) => ({
    x: pad + (c[0] - minLon) * scale + (w - (maxLon - minLon) * scale) / 2,
    y: pad + (maxLat - c[1]) * scale + (h - (maxLat - minLat) * scale) / 2,
  }));

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const start = points[0];
  const end = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
      <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={start.x} cy={start.y} r="4" fill={color} stroke="white" strokeWidth="2" />
      <circle cx={end.x} cy={end.y} r="4" fill="#ef4444" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function RouteDetail({ route, onBack }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [editName, setEditName] = useState("");
  const [editStartName, setEditStartName] = useState("");
  const [editEndName, setEditEndName] = useState("");
  const [editStops, setEditStops] = useState([]);
  const [placingStop, setPlacingStop] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/transport/routes/${route.id}/`)
      .then((r) => {
        const d = r.data;
        setDetail(d);
        setEditName(d.name || route.name);
        setEditStartName(d.start_name || route.start_name || "");
        setEditEndName(d.end_name || route.end_name || "");
        setEditStops((d.stops || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => ({
          id: s.id,
          name: s.name,
          order: s.order,
          lat: s.location?.coordinates?.[1] || s.lat || 0,
          lon: s.location?.coordinates?.[0] || s.lon || 0,
          cumulative_distance_m: s.cumulative_distance_m || 0,
        })));
      })
      .catch(() => {
        setDetail(route);
        setEditName(route.name);
        setEditStartName(route.start_name || "");
        setEditEndName(route.end_name || "");
        setEditStops([]);
      })
      .finally(() => setLoading(false));
  }, [route.id]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const addStopMarker = useCallback((map, s, i, total, onStopClick) => {
    const el = document.createElement("div");
    el.className = "flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-md text-[11px] font-bold text-white cursor-pointer";
    el.style.backgroundColor = i === 0 ? "#16a34a" : i === total - 1 ? "#ef4444" : "#6366f1";
    el.textContent = s.order || i + 1;

    const mk = new maplibregl.Marker({ element: el })
      .setLngLat([s.lon, s.lat])
      .setPopup(new maplibregl.Popup({ offset: 15 }).setText(`${s.order || i + 1}. ${s.name}`))
      .addTo(map);

    if (editing) {
      mk.setDraggable(true);
      mk.on("dragend", () => {
        const pos = mk.getLngLat();
        onStopClick(i, { lat: pos.lat, lon: pos.lng });
      });
    }

    markersRef.current.push(mk);
  }, [editing]);

  const initMap = useCallback(() => {
    if (mapRef.current || !mapContainer.current) return;

    const stops = editing ? editStops : (detail?.stops || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const coords = stops.length > 0
      ? stops.map((s) => [s.lon || s.location?.coordinates?.[0], s.lat || s.location?.coordinates?.[1]]).filter((c) => c[0] && c[1])
      : (route.path?.coordinates || []);

    const center = coords.length > 0
      ? coords[Math.floor(coords.length / 2)]
      : [80.9462, 26.8467];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center,
      zoom: coords.length > 10 ? 12 : 13,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      if (coords.length > 1) {
        map.addSource("route-line", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
        });
        map.addLayer({
          id: "route-line-bg", type: "line", source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#22c55e", "line-width": 8, "line-opacity": 0.2 },
        });
        map.addLayer({
          id: "route-line-fg", type: "line", source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#16a34a", "line-width": 4 },
        });

        const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
        map.fitBounds(bounds, { padding: 60 });
      }

      stops.forEach((s, i) => {
        const loc = s.location?.coordinates || (s.lat && s.lon ? [s.lon, s.lat] : null);
        if (!loc || !loc[0]) return;
        addStopMarker(map, { ...s, lon: loc[0], lat: loc[1] }, i, stops.length, (idx, newPos) => {
          setEditStops((prev) => prev.map((ps, pi) => pi === idx ? { ...ps, lat: newPos.lat, lon: newPos.lon } : ps));
        });
      });

      if (editing) {
        map.on("click", (e) => {
          if (placingStop !== null) {
            const { lng, lat } = e.lngLat;
            setEditStops((prev) => {
              const updated = [...prev];
              updated[placingStop] = { ...updated[placingStop], lat, lon: lng };
              return updated;
            });
            setPlacingStop(null);
          }
        });
      }
    });

    mapRef.current = map;
  }, [route, detail, editing, editStops, addStopMarker, placingStop]);

  useEffect(() => {
    if (!loading && detail) {
      clearMarkers();
      setTimeout(initMap, 100);
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, detail, initMap]);

  useEffect(() => {
    if (mapRef.current && editing) {
      clearMarkers();
      const map = mapRef.current;
      editStops.forEach((s, i) => {
        if (!s.lon || !s.lat) return;
        addStopMarker(map, s, i, editStops.length, (idx, newPos) => {
          setEditStops((prev) => prev.map((ps, pi) => pi === idx ? { ...ps, lat: newPos.lat, lon: newPos.lon } : ps));
        });
      });
    }
  }, [editStops, editing, addStopMarker]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/transport/routes/${route.id}/`, {
        name: editName,
        start_name: editStartName,
        end_name: editEndName,
      });

      for (const s of editStops) {
        if (!s.id) continue;
        try {
          await api.patch(`/transport/stops/${s.id}/`, {
            name: s.name,
            location: { type: "Point", coordinates: [s.lon, s.lat] },
            order: s.order,
          });
        } catch (e) {
          console.error(`Stop ${s.name} save failed:`, e);
        }
      }

      setEditing(false);
      const res = await api.get(`/transport/routes/${route.id}/`);
      setDetail(res.data);
      showToast("Route saved successfully");
    } catch (e) {
      showToast("Save failed: " + (e.response?.data?.detail || e.message), "error");
    }
    setSaving(false);
  };

  const updateStopName = (idx, name) => {
    setEditStops((prev) => prev.map((s, i) => i === idx ? { ...s, name } : s));
  };

  const updateStopCoord = (idx, field, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setEditStops((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: num } : s));
  };

  const removeStop = (idx) => {
    setEditStops((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const stops = editing
    ? editStops
    : (detail?.stops || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="flex h-full">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-bold text-white transition ${
          toast.type === "error" ? "bg-red-500" : "bg-emerald-500"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-5 bg-slate-900 text-white space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
              <ArrowLeft size={16} /> Back
            </button>
            {!loading && (
              editing ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(false)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50">
                    <Save size={13} /> {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition">
                  <Edit3 size={13} /> Edit
                </button>
              )
            )}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-5 bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
            </div>
          ) : editing ? (
            <div className="space-y-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg outline-none focus:ring-2 focus:ring-brand-500" placeholder="Route name" />
              <div className="flex gap-2">
                <input value={editStartName} onChange={(e) => setEditStartName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Start name" />
                <input value={editEndName} onChange={(e) => setEditEndName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg outline-none focus:ring-2 focus:ring-red-500" placeholder="End name" />
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-lg leading-tight">{detail?.name || route.name}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Navigation size={14} className="text-emerald-400" />
                {detail?.start_name || route.start_name} → {detail?.end_name || route.end_name}
              </div>
              <div className="flex gap-2 flex-wrap">
                {detail?.route_code && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300">{detail.route_code}</span>
                )}
                {detail?.total_distance_meters ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300">
                    {(detail.total_distance_meters / 1000).toFixed(1)} km
                  </span>
                ) : null}
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                  detail?.is_public ? "bg-emerald-900/50 text-emerald-300" : "bg-slate-700 text-slate-400"
                }`}>
                  {detail?.is_public ? "Public" : "Private"}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {stops.length} Stop{stops.length !== 1 ? "s" : ""}
          </p>
          {editing && (
            <button onClick={() => setPlacingStop(editStops.length)}
              className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                placingStop !== null ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
              }`}>
              <Plus size={12} /> {placingStop !== null ? "Click map..." : "Add Stop"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg" />
                  <div className="flex-1 h-4 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-0.5 bg-slate-100" />
              <div className="p-4 space-y-1">
                {stops.map((s, i) => {
                  const isStart = i === 0;
                  const isEnd = i === stops.length - 1;
                  return (
                    <div key={s.id || i} className="relative flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-slate-50 transition group/stop">
                      <div
                        className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 cursor-pointer"
                        style={{ backgroundColor: isStart ? "#16a34a" : isEnd ? "#ef4444" : "#6366f1" }}
                        onClick={() => {
                          if (editing && s.lon && s.lat && mapRef.current) {
                            mapRef.current.flyTo({ center: [s.lon, s.lat], zoom: 16, duration: 800 });
                          }
                        }}
                      >
                        {s.order || i + 1}
                      </div>

                      {editing ? (
                        <div className="flex-1 min-w-0 space-y-1">
                          <input value={s.name} onChange={(e) => updateStopName(i, e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold outline-none focus:ring-1 focus:ring-brand-500" />
                          <div className="flex gap-1">
                            <input value={s.lat?.toFixed(6) || ""} onChange={(e) => updateStopCoord(i, "lat", e.target.value)}
                              className="flex-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500 outline-none focus:ring-1 focus:ring-brand-500" placeholder="Lat" />
                            <input value={s.lon?.toFixed(6) || ""} onChange={(e) => updateStopCoord(i, "lon", e.target.value)}
                              className="flex-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500 outline-none focus:ring-1 focus:ring-brand-500" placeholder="Lon" />
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setPlacingStop(i)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${
                                placingStop === i ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}>
                              {placingStop === i ? "Click map..." : "Pin on map"}
                            </button>
                            <button onClick={() => removeStop(i)}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-400 hover:bg-red-100 transition opacity-0 group-hover/stop:opacity-100">
                              <Trash2 size={10} className="inline" /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                          {s.cumulative_distance_m > 0 && (
                            <p className="text-[10px] text-slate-400 font-medium">
                              {(s.cumulative_distance_m / 1000).toFixed(1)} km from start
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {stops.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">No stops data</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainer} className="h-full w-full" />
        {editing && placingStop !== null && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-5 py-2.5 rounded-xl shadow-xl text-sm font-bold z-10">
            Click on the map to place stop {placingStop + 1}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RouteExplorer() {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [viewRoute, setViewRoute] = useState(null);

  useEffect(() => {
    api.get("/transport/cities/").then((r) => {
      const d = Array.isArray(r.data) ? r.data : r.data.results || [];
      setCities(d);
      if (d.length) setSelectedCity(d[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    setLoading(true);
    api.get(`/transport/routes/?city_id=${selectedCity}`)
      .then((r) => setRoutes(Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false));
  }, [selectedCity]);

  const filtered = routes.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.start_name?.toLowerCase().includes(q) ||
      r.end_name?.toLowerCase().includes(q)
    );
  });

  const selectedCityName = cities.find((c) => c.id === selectedCity)?.name || "Select City";

  if (viewRoute) {
    return <RouteDetail route={viewRoute} onBack={() => { setViewRoute(null); }} />;
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <RouteIcon className="text-brand-500" size={32} />
            Route Explorer
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Browse and edit routes with polyline visualization</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="relative">
          <button
            onClick={() => setCityOpen(!cityOpen)}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300 transition min-w-[200px]"
          >
            <MapPin size={16} className="text-brand-500" />
            <span className="flex-1 text-left">{selectedCityName}</span>
            <ChevronDown size={16} className={`text-slate-400 transition ${cityOpen ? "rotate-180" : ""}`} />
          </button>
          {cityOpen && (
            <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
              {cities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCity(c.id); setCityOpen(false); setSearch(""); }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition ${
                    c.id === selectedCity ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search routes..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-brand-600/20 focus:border-brand-300 transition"
          />
        </div>

        <div className="bg-brand-50 text-brand-700 px-4 py-3 rounded-xl text-sm font-bold">
          {filtered.length} route{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((r, idx) => {
            const c = getRouteColor(idx);
            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition group overflow-hidden"
              >
                <div className="p-4 pb-2">
                  <RoutePolyline coordinates={r.path?.coordinates} color={c.line} />
                </div>

                <div className="px-5 pb-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition" style={{ backgroundColor: c.bg, color: c.text }}>
                      <Bike size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-slate-900 truncate">{r.name}</h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {r.start_name || "Start"} → {r.end_name || "End"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {r.total_distance_meters ? (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: c.bg, color: c.text }}>
                        {(r.total_distance_meters / 1000).toFixed(1)} km
                      </span>
                    ) : null}
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      r.is_public ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                    }`}>
                      {r.is_public ? "Public" : "Private"}
                    </span>
                    {r.stops_count != null && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: c.bg, color: c.text }}>
                        {r.stops_count} stops
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.dot }} />
                      <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[100px]">{r.start_name || "Start"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[100px]">{r.end_name || "End"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setViewRoute(r)}
                    className="mt-3 w-full py-2.5 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 hover:opacity-90"
                    style={{ backgroundColor: c.line }}
                  >
                    <Navigation size={14} /> View Route
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-full text-center py-20">
              <Bike size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-medium text-lg">No routes found</p>
              <p className="text-slate-300 text-sm mt-1">
                {search ? "Try a different search term" : "No routes in this city yet"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
