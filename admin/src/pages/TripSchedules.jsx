import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, CalendarClock } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

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
    <div className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="glass-title">Trip Schedules</h1>
          <p className="text-slate-500 mt-2 font-medium">Manage route schedules and timings</p>
        </div>
        <button onClick={openCreate} className="glass-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Schedule
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schedules.map((s, index) => (
            <div key={s.id} className="glass-card p-6 relative overflow-hidden animate-glass-fade-in"
              style={{ animationDelay: `${index * 60}ms` }}>
              {/* Gradient blob */}
              <div className="gradient-blob blob-soft w-20 h-20 -top-6 -right-6 animate-blob-float"
                style={{ animationDelay: `${index * 400}ms` }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-semibold text-lg text-slate-800">
                      <CalendarClock size={16} className="shrink-0" style={{ color: "var(--accent-blue-light)" }} />
                      <span className="truncate">{s.label}</span>
                    </h3>
                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                      {getRouteName(s.route)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(s)} className="p-2 hover:bg-white/50 rounded-xl text-slate-500 hover:text-accent-primary transition-all duration-200">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-xl text-slate-500 hover:text-red-500 transition-all duration-200">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200/60">
                  <span className="text-sm font-semibold text-slate-800">
                    {s.scheduled_start_time || "N/A"}
                  </span>
                  <span className={`glass-badge ${s.is_active ? "glass-badge-success" : "glass-badge-warning"}`}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {schedules.length === 0 && (
            <EmptyState
              icon={CalendarClock}
              title="No schedules found"
              description="Create your first schedule to get started."
              className="col-span-full"
            />
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card-strong w-full max-w-md animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
              <h2 className="text-xl font-semibold text-slate-800">{editing ? "Edit Schedule" : "New Schedule"}</h2>
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
                <label className="glass-label">Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                  placeholder="e.g. Morning Shift"
                  className="glass-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">Start Time</label>
                <input
                  type="time"
                  value={form.scheduled_start_time}
                  onChange={(e) => setForm({ ...form, scheduled_start_time: e.target.value })}
                  required
                  className="glass-input"
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-2 border-accent-primary text-accent-primary focus:ring-accent-primary"
                />
                Active
              </label>
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
