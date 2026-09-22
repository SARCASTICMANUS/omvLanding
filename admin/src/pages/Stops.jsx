import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, MapPin, MoveVertical, StopCircle } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import { Squiggle } from "../components/MemphisShapes";

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
    } catch { /* ignore */ }
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
        await api.put(`/transport/stops/${editing.id}/`, payload);
      } else {
        await api.post("/transport/stops/", payload);
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
      await api.delete(`/transport/stops/${id}/`);
      fetchData();
    } catch { /* ignore */ }
  };

  const getRouteName = (routeId) => {
    const r = routes.find((r) => r.id === routeId);
    return r?.name || "Unknown";
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="memphis-title">Stops</h1>
          <p className="text-memphis-purple mt-2 font-medium">Manage route stops</p>
        </div>
        <button onClick={openCreate} className="memphis-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Stop
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="memphis-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-memphis-ink/5 border-b-2 border-memphis-ink">
                <th className="px-6 py-4 text-left memphis-label">#</th>
                <th className="px-6 py-4 text-left memphis-label">Name</th>
                <th className="px-6 py-4 text-left memphis-label">Route</th>
                <th className="px-6 py-4 text-left memphis-label">Coordinates</th>
                <th className="px-6 py-4 text-right memphis-label">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s) => {
                const coords = s.location?.coordinates || [];
                return (
                  <tr key={s.id} className="memphis-table-row">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-memphis-purple">
                        <MoveVertical size={14} className="text-memphis-purple/40" />
                        {s.order}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-memphis-ink">{s.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-memphis-purple">{getRouteName(s.route)}</td>
                    <td className="px-6 py-4">
                      <span className="memphis-mono text-xs text-memphis-purple/60">
                        {coords.length ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="p-2 hover:bg-memphis-ink/5 rounded-lg text-memphis-purple transition-all duration-200">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-memphis-coral/10 rounded-lg text-memphis-coral transition-all duration-200">
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
        <div className="fixed inset-0 bg-memphis-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-memphis-paper border-2 border-memphis-ink rounded-xl w-full max-w-lg shadow-memphis-lg">
            <div className="flex items-center justify-between p-6 border-b-2 border-memphis-ink">
              <h2 className="text-xl font-bold text-memphis-ink">{editing ? "Edit Stop" : "New Stop"}</h2>
              <button onClick={() => setModal(false)} className="text-memphis-purple hover:text-memphis-ink transition-all duration-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="memphis-label">Route</label>
                <select
                  value={form.route}
                  onChange={(e) => setForm({ ...form, route: e.target.value })}
                  required
                  className="memphis-input"
                >
                  <option value="">Select route...</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="memphis-label">Stop Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="memphis-input"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="memphis-label">Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    required
                    className="memphis-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="memphis-label">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    required
                    className="memphis-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="memphis-label">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lon}
                    onChange={(e) => setForm({ ...form, lon: e.target.value })}
                    required
                    className="memphis-input"
                  />
                </div>
              </div>
              <button type="submit" className="w-full memphis-btn-primary py-4 flex items-center justify-center gap-2">
                <Save size={16} /> {editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
