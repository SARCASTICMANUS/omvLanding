import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, MapPin, MoveVertical, StopCircle } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import PageToolbar from "../components/PageToolbar";

export default function Stops() {
  const [stops, setStops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ route: "", name: "", order: 0, lat: "", lon: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        api.get("/transport/stops/"),
        api.get("/transport/routes/"),
      ]);
      setStops(Array.isArray(sRes.data) ? sRes.data : sRes.data.results || []);
      setRoutes(Array.isArray(rRes.data) ? rRes.data : rRes.data.results || []);
    } catch (err) { alert(err.response?.data?.detail || "Failed to delete stop"); }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ route: "", name: "", order: 0, lat: "", lon: "" });
    setModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    const coords = s.location?.coordinates || [];
    setForm({
      route: s.route || "",
      name: s.name,
      order: s.order,
      lat: coords[1] ?? "",
      lon: coords[0] ?? "",
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      route: form.route,
      name: form.name,
      order: parseInt(form.order),
      location: {
        type: "Point",
        coordinates: [parseFloat(form.lon), parseFloat(form.lat)],
      },
    };
    try {
      if (editing) {
        await api.put(`/transport/admin/stops/${editing.id}/`, payload);
      } else {
        await api.post("/transport/admin/stops/", payload);
      }
      setModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save stop");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this stop?")) return;
    try {
      await api.delete(`/transport/admin/stops/${id}/`);
      fetchData();
    } catch (err) { alert(err.response?.data?.detail || "Failed to delete stop"); }
  };

  const getRouteName = (routeId) => {
    const r = routes.find((r) => r.id === routeId);
    return r?.name || "Unknown";
  };

  return (
    <div data-scroll className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <PageToolbar>
        <button onClick={openCreate} className="glass-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Stop
        </button>
      </PageToolbar>

      {loading ? (
        <Loader />
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200/60">
                <th className="px-6 py-4 text-left glass-label">#</th>
                <th className="px-6 py-4 text-left glass-label">Name</th>
                <th className="px-6 py-4 text-left glass-label">Route</th>
                <th className="px-6 py-4 text-left glass-label">Coordinates</th>
                <th className="px-6 py-4 text-right glass-label">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s) => {
                const coords = s.location?.coordinates || [];
                return (
                  <tr key={s.id} className="glass-table-row">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent-primary">
                        <MoveVertical size={14} className="opacity-50" />
                        {s.order}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{getRouteName(s.route)}</td>
                    <td className="px-6 py-4">
                      <span className="glass-mono text-xs text-slate-500">
                        {coords.length ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-accent-primary transition-all duration-200">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-xl text-slate-500 hover:text-red-500 transition-all duration-200">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {stops.length === 0 && (
            <EmptyState
              icon={StopCircle}
              title="No stops found"
              description="Add stops to your routes to get started."
            />
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card-strong w-full max-w-lg animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
              <h2 className="text-xl font-semibold text-slate-800">{editing ? "Edit Stop" : "New Stop"}</h2>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="glass-label">Route</label>
                <select
                  value={form.route}
                  onChange={(e) => setForm({ ...form, route: e.target.value })}
                  required
                  className="glass-select"
                >
                  <option value="">Select route...</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">Stop Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="glass-input"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="glass-label">Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    required
                    className="glass-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="glass-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    required
                    className="glass-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="glass-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lon}
                    onChange={(e) => setForm({ ...form, lon: e.target.value })}
                    required
                    className="glass-input"
                  />
                </div>
              </div>
              <button type="submit" className="w-full glass-btn-primary py-3.5 flex items-center justify-center gap-2">
                <Save size={16} /> {editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
