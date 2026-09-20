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
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="memphis-title">Trip Schedules</h1>
          <p className="text-memphis-purple mt-2 font-medium">Manage route schedules and timings</p>
        </div>
        <button onClick={openCreate} className="memphis-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Schedule
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schedules.map((s) => (
            <div key={s.id} className="memphis-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="memphis-icon-tile bg-memphis-yellow">
                  <CalendarClock size={20} className="text-memphis-ink" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(s)} className="p-2 hover:bg-memphis-ink/5 rounded-lg text-memphis-purple transition-all duration-200">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-memphis-coral/10 rounded-lg text-memphis-coral transition-all duration-200">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-memphis-ink">{s.label}</h3>
              <p className="text-sm text-memphis-purple font-medium mt-1">
                {getRouteName(s.route)}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-memphis-ink/10">
                <span className="text-sm font-bold text-memphis-ink">
                  {s.scheduled_start_time || "N/A"}
                </span>
                <span
                  className={`memphis-badge ${
                    s.is_active
                      ? "bg-memphis-mint/20 text-memphis-mint border-memphis-mint"
                      : "bg-memphis-purple/10 text-memphis-purple border-memphis-purple/30"
                  }`}
                >
                  {s.is_active ? "Active" : "Inactive"}
                </span>
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
        <div className="fixed inset-0 bg-memphis-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-memphis-paper border-2 border-memphis-ink rounded-xl w-full max-w-md shadow-memphis-lg">
            <div className="flex items-center justify-between p-6 border-b-2 border-memphis-ink">
              <h2 className="text-xl font-bold text-memphis-ink">{editing ? "Edit Schedule" : "New Schedule"}</h2>
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
                <label className="memphis-label">Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                  placeholder="e.g. Morning Shift"
                  className="memphis-input"
                />
              </div>
              <div className="space-y-1">
                <label className="memphis-label">Start Time</label>
                <input
                  type="time"
                  value={form.scheduled_start_time}
                  onChange={(e) => setForm({ ...form, scheduled_start_time: e.target.value })}
                  required
                  className="memphis-input"
                />
              </div>
              <label className="flex items-center gap-3 text-sm font-semibold text-memphis-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-5 h-5 rounded border-2 border-memphis-ink text-memphis-pink focus:ring-memphis-pink"
                />
                Active
              </label>
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
