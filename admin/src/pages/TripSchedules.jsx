import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, CalendarClock } from "lucide-react";
import api from "../api/client";

export default function TripSchedules() {
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ route: "", label: "", scheduled_start_time: "", is_active: true });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [schRes, rRes] = await Promise.all([
        api.get("/transport/schedules/"),
        api.get("/transport/routes/"),
      ]);
      setSchedules(Array.isArray(schRes.data) ? schRes.data : schRes.data.results || []);
      setRoutes(Array.isArray(rRes.data) ? rRes.data : rRes.data.results || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ route: "", label: "", scheduled_start_time: "", is_active: true });
    setModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      route: s.route || "",
      label: s.label,
      scheduled_start_time: s.scheduled_start_time || "",
      is_active: s.is_active,
    });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/transport/schedules/${editing.id}/`, form);
      } else {
        await api.post("/transport/schedules/", form);
      }
      setModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save schedule");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this schedule?")) return;
    try {
      await api.delete(`/transport/schedules/${id}/`);
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
          <h1 className="text-3xl font-black text-slate-800">Trip Schedules</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage route schedules and timings</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25"
        >
          <Plus size={18} /> Add Schedule
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                  <CalendarClock size={22} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(s)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-slate-800">{s.label}</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {getRouteName(s.route)}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                <span className="text-sm font-bold text-slate-700">
                  {s.scheduled_start_time || "N/A"}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    s.is_active
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
          {schedules.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400 font-medium">
              No schedules found.
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold">{editing ? "Edit Schedule" : "New Schedule"}</h2>
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                  placeholder="e.g. Morning Shift"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Start Time</label>
                <input
                  type="time"
                  value={form.scheduled_start_time}
                  onChange={(e) => setForm({ ...form, scheduled_start_time: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                />
                Active
              </label>
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
