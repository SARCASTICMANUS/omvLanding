import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Bike, MapPin, ChevronDown, ArrowLeft, Navigation, Edit3, Save, Trash2, Plus } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import api from "../api/client";
import { getRouteColors } from "../colors";
import { getAccentColor, ACCENT_CHANGE_EVENT } from "../utils/glow";
import useAccentTick from "../hooks/useAccentTick";
import EmptyState from "../components/EmptyState";
import Loader from "../components/Loader";

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

function getRouteColorKey(startName, endName) {
  if (!startName || !endName) return null;
  const a = startName.trim().toLowerCase();
  const b = endName.trim().toLowerCase();
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

function buildRouteColorMap(routes) {
  const pairKeys = new Map();
  let colorIdx = 0;

  routes.forEach((r) => {
    const key = getRouteColorKey(r.start_name, r.end_name);
    if (key && !pairKeys.has(key)) {
      pairKeys.set(key, colorIdx % getRouteColors().length);
      colorIdx++;
    }
  });

  return (r) => {
    const key = getRouteColorKey(r.start_name, r.end_name);
    if (key && pairKeys.has(key)) {
      return getRouteColors()[pairKeys.get(key)];
    }
    const fallback = colorIdx % getRouteColors().length;
    colorIdx++;
    return getRouteColors()[fallback];
  };
}

function RoutePolyline({ coordinates, color = "var(--accent-blue)", width = 400, height = 80 }) {
  if (!coordinates || coordinates.length < 2) {
    return (
      <div className="w-full h-20 bg-slate-100/50 rounded-xl flex items-center justify-center">
        <span className="text-xs text-slate-500 font-medium">No path data</span>
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
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <path d={d} fill="none" style={{ stroke: color }} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={start.x} cy={start.y} r="4" style={{ fill: color }} stroke="#F1F6F1" strokeWidth="2" />
      <circle cx={end.x} cy={end.y} r="4" style={{ fill: "var(--accent-blue-dark)" }} stroke="#C3D9FF" strokeWidth="2" />
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

  useEffect(() => {
    const onAccent = () => {
      try {
        const m = mapRef.current;
        if (!m) return;
        if (m.getLayer("route-line-bg")) m.setPaintProperty("route-line-bg", "line-color", getAccentColor().hex);
        if (m.getLayer("route-line-fg")) m.setPaintProperty("route-line-fg", "line-color", getAccentColor().dark);
      } catch (err) { console.error("RouteExplorer error:", err); alert("An error occurred"); }
    };
    window.addEventListener(ACCENT_CHANGE_EVENT, onAccent);
    return () => window.removeEventListener(ACCENT_CHANGE_EVENT, onAccent);
  }, []);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const addStopMarker = useCallback((map, s, i, total, onStopClick) => {
    const el = document.createElement("div");
    // Memphis functional pins: mint start, coral end, blue mid with white ring
    el.className = "flex items-center justify-center w-7 h-7 rounded-full border-2 border-white/80 shadow-md text-[11px] font-semibold text-white cursor-pointer";
    el.style.backgroundColor = i === 0 ? "var(--accent-blue-light)" : i === total - 1 ? "var(--accent-blue-dark)" : "var(--accent-blue)";
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

    const savedPath = detail?.path?.coordinates;
    const coords = savedPath && savedPath.length >= 2
      ? savedPath
      : stops.length > 0
        ? stops.map((s) => [s.lon || s.location?.coordinates?.[0], s.lat || s.location?.coordinates?.[1]]).filter((c) => c[0] && c[1])
        : [];

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
          paint: { "line-color": getAccentColor().hex, "line-width": 8, "line-opacity": 0.2 },
        });
        map.addLayer({
          id: "route-line-fg", type: "line", source: "route-line",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": getAccentColor().dark, "line-width": 4 },
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
      await api.patch(`/transport/admin/routes/${route.id}/`, {
        name: editName,
        start_name: editStartName,
        end_name: editEndName,
      });

      for (const s of editStops) {
        if (!s.id) continue;
        try {
          await api.patch(`/transport/admin/stops/${s.id}/`, {
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
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition ${
          toast.type === "error" ? "bg-red-500" : "bg-emerald-500"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="w-[400px] bg-white/70 backdrop-blur-xl border-r border-white/60 flex flex-col shrink-0" style={{ boxShadow: "8px 0 32px rgb(var(--accent-blue-rgb) / 0.05)" }}>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-700 transition">
              <ArrowLeft size={16} /> Back
            </button>
            {!loading && (
              editing ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(false)} className="glass-btn-secondary text-xs font-semibold px-3 py-1.5">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="glass-btn-primary text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                    <Save size={13} /> {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="glass-btn-secondary text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5">
                  <Edit3 size={13} /> Edit
                </button>
              )
            )}
          </div>

          {loading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-5 bg-indigo-100 rounded w-3/4" />
              <div className="h-3 bg-indigo-100 rounded w-1/2" />
            </div>
          ) : editing ? (
            <div className="space-y-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="glass-input w-full text-sm font-semibold" placeholder="Route name" />
              <div className="flex gap-2">
                <input value={editStartName} onChange={(e) => setEditStartName(e.target.value)}
                  className="glass-input flex-1 text-xs" placeholder="Start name" />
                <input value={editEndName} onChange={(e) => setEditEndName(e.target.value)}
                  className="glass-input flex-1 text-xs" placeholder="End name" />
              </div>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-lg leading-tight text-slate-800">{detail?.name || route.name}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                <Navigation size={14} className="text-[#5B8AFF]" />
                {detail?.start_name || route.start_name} → {detail?.end_name || route.end_name}
              </div>
              <div className="flex gap-2 flex-wrap">
                {detail?.route_code && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue)" }}>{detail.route_code}</span>
                )}
                {detail?.total_distance_meters ? (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", color: "var(--accent-blue)" }}>
                    {(detail.total_distance_meters / 1000).toFixed(1)} km
                  </span>
                ) : null}
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                  detail?.is_public ? "text-[#16a34a]" : "text-slate-500"
                }`} style={{
                  background: detail?.is_public ? "rgba(123,224,173,0.18)" : "rgba(148,163,184,0.12)",
                }}>
                  {detail?.is_public ? "Public" : "Private"}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-b border-slate-200/50 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {stops.length} Stop{stops.length !== 1 ? "s" : ""}
          </p>
          {editing && (
            <button onClick={() => setPlacingStop(editStops.length)}
              className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                placingStop !== null
                  ? "text-[#2E5CFF]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              style={{
                background: placingStop !== null ? "rgb(var(--accent-blue-rgb) / 0.1)" : "rgb(var(--accent-blue-rgb) / 0.06)",
              }}>
              <Plus size={12} /> {placingStop !== null ? "Click map..." : "Add Stop"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200/70 rounded-lg" />
                  <div className="flex-1 h-4 bg-slate-200/70 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[27px] top-0 bottom-0 w-0.5" style={{ background: "rgb(var(--accent-blue-rgb) / 0.12)" }} />
              <div className="p-4 space-y-1">
                {stops.map((s, i) => {
                  const isStart = i === 0;
                  const isEnd = i === stops.length - 1;
                  return (
                    <div key={s.id || i} className="relative flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-white/70 transition group/stop">
                      <div
                        className="relative z-10 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold text-white shrink-0 cursor-pointer"
                        style={{ backgroundColor: isStart ? "var(--accent-blue-light)" : isEnd ? "var(--accent-blue-dark)" : "var(--accent-blue)" }}
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
                            className="glass-input w-full text-xs font-semibold" />
                          <div className="flex gap-1">
                            <input value={s.lat?.toFixed(6) || ""} onChange={(e) => updateStopCoord(i, "lat", e.target.value)}
                              className="glass-input flex-1 text-[10px] text-slate-500" placeholder="Lat" />
                            <input value={s.lon?.toFixed(6) || ""} onChange={(e) => updateStopCoord(i, "lon", e.target.value)}
                              className="glass-input flex-1 text-[10px] text-slate-500" placeholder="Lon" />
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setPlacingStop(i)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded transition ${
                                placingStop === i ? "text-[#2E5CFF]" : "text-slate-500 hover:text-slate-700"
                              }`}
                              style={{
                                background: placingStop === i ? "rgb(var(--accent-blue-rgb) / 0.12)" : "rgb(var(--accent-blue-rgb) / 0.06)",
                              }}>
                              {placingStop === i ? "Click map..." : "Pin on map"}
                            </button>
                            <button onClick={() => removeStop(i)}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded text-red-500 transition opacity-0 group-hover/stop:opacity-100" style={{ background: "rgba(255,93,93,0.1)" }}>
                              <Trash2 size={10} className="inline" /> Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          {s.cumulative_distance_m > 0 && (
                            <p className="text-[10px] text-slate-500 font-medium">
                              {(s.cumulative_distance_m / 1000).toFixed(1)} km from start
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {stops.length === 0 && (
                  <div className="text-center py-8 text-slate-500 text-sm">No stops data</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <div ref={mapContainer} className="h-full w-full" />
        {editing && placingStop !== null && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white z-10" style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-blue-light))" }}>
            Click on the map to place stop {placingStop + 1}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RouteExplorer() {
  useAccentTick();
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [viewRoute, setViewRoute] = useState(null);
  const cityRef = useRef(null);

  useEffect(() => {
    if (!cityOpen) return;
    const onDocDown = (e) => {
      if (cityRef.current && !cityRef.current.contains(e.target)) setCityOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setCityOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [cityOpen]);

  useEffect(() => {
    api.get("/transport/cities/")
      .then((r) => {
        const d = Array.isArray(r.data)
          ? r.data
          : Array.isArray(r.data?.data)
            ? r.data.data
            : r.data?.results || [];
        setCities(d);
        if (d.length) setSelectedCity((prev) => prev || d[0].id);
      })
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    setLoading(true);
    api.get(`/transport/routes/?city_id=${selectedCity}`)
      .then((r) => setRoutes(
        Array.isArray(r.data) ? r.data : Array.isArray(r.data?.data) ? r.data.data : r.data?.results || []
      ))
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

  const getRouteColor = buildRouteColorMap(filtered);

  if (viewRoute) {
    return <RouteDetail route={viewRoute} onBack={() => { setViewRoute(null); }} />;
  }

  return (
    <div className="pt-5 pb-8 px-6 md:px-8 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative" ref={cityRef}>
          <button
            type="button"
            onClick={() => setCityOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={cityOpen}
            className="glass-btn flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-800 min-w-[200px]"
          >
            <MapPin size={16} className="text-[#2E5CFF]" />
            <span className="flex-1 text-left">{selectedCityName}</span>
            <ChevronDown size={16} className={`text-slate-400 transition ${cityOpen ? "rotate-180" : ""}`} />
          </button>
          {cityOpen && (
            <div
              role="listbox"
              className="absolute top-full left-0 mt-1 w-full min-w-[200px] glass-card-strong rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto"
            >
              {cities.length === 0 && (
                <div className="px-4 py-3 text-sm text-slate-500">No cities available</div>
              )}
              {cities.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCity(c.id);
                    setCityOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition ${
                    c.id === selectedCity ? "text-accent-primary" : "text-slate-800 hover:bg-white/70 dark:hover:bg-white/10"
                  }`}
                  style={c.id === selectedCity ? { background: "rgb(var(--accent-blue-rgb) / 0.08)" } : {}}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search routes..."
            className="glass-input w-full pl-10 pr-4 py-3 text-sm font-medium"
          />
        </div>

        <div
          className="px-4 py-3 rounded-xl text-sm font-semibold text-accent-primary"
          style={{ background: "rgb(var(--accent-blue-rgb) / 0.08)", border: "1px solid rgb(var(--accent-blue-rgb) / 0.2)" }}
        >
          {filtered.length} route{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={search ? "No routes found" : "No routes yet"}
          description={
            search
              ? "Try a different search term."
              : routes.length === 0
                ? "Select a city to load its routes."
                : "No routes to display."
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((r) => {
            const c = getRouteColor(r);
            return (
              <div
                key={r.id}
                className="glass-card group overflow-hidden"
              >
                <div className="p-4 pb-2">
                  <RoutePolyline coordinates={r.path?.coordinates} color={c.line} />
                </div>

                <div className="px-5 pb-4">
                  <div className="mb-3">
                    <h3 className="font-semibold text-base text-slate-800 truncate inline-flex items-center gap-1.5">
                      <Bike size={14} className="shrink-0" style={{ color: "var(--accent-blue)" }} />
                      <span className="truncate">{r.name}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {r.start_name || "Start"} → {r.end_name || "End"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {r.total_distance_meters ? (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: c.bg, color: c.text }}>
                        {(r.total_distance_meters / 1000).toFixed(1)} km
                      </span>
                    ) : null}
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                      r.is_public ? "text-[#16a34a]" : "text-slate-500"
                    }`} style={{
                      background: r.is_public ? "rgba(123,224,173,0.18)" : "rgba(148,163,184,0.12)",
                    }}>
                      {r.is_public ? "Public" : "Private"}
                    </span>
                    {r.stops_count != null && (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: c.bg, color: c.text }}>
                        {r.stops_count} stops
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 pt-3 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.dot }} />
                      <span className="text-[11px] font-medium text-slate-500 truncate max-w-[100px]">{r.start_name || "Start"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-[11px] font-medium text-slate-500 truncate max-w-[100px]">{r.end_name || "End"}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setViewRoute(r)}
                    className="glass-btn-primary mt-3 w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: c.line }}
                  >
                    <Navigation size={14} /> View Route
                  </button>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-full">
              <EmptyState
                icon={Bike}
                title="No routes found"
                description={search ? "Try a different search term" : "No routes in this city yet"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
