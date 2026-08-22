import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, MapPin, MoveVertical } from "lucide-react";
import api from "../api/client";

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
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Stops</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage route stops</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25"
        >
          <Plus size={18} /> Add Stop
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Coordinates</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stops.map((s) => {
                const coords = s.location?.coordinates || [];
                return (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition group">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-slate-600">
                        <MoveVertical size={14} className="text-slate-300" />
                        {s.order}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{getRouteName(s.route)}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-slate-400">
                        {coords.length ? `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}` : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(s)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400">
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
            <div className="text-center py-16 text-slate-400 font-medium">
              No stops found.
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold">{editing ? "Edit Stop" : "New Stop"}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Route</label>
                <select
                  value={form.route}
                  onChange={(e) => setForm({ ...form, route: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                >
                  <option value="">Select route...</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stop Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lon}
                    onChange={(e) => setForm({ ...form, lon: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2"
              >
                <Save size={16} /> {editing ? "Update" : "Create"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
