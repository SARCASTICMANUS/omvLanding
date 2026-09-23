import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, MapPin } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";
import PageToolbar from "../components/PageToolbar";

export default function Cities() {
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", state: "", country: "India" });

  useEffect(() => { fetchCities(); }, []);

  const fetchCities = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport/cities/");
      setCities(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", state: "", country: "India" });
    setModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, state: c.state || "", country: c.country || "India" });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/transport/cities/${editing.id}/`, form);
      } else {
        await api.post("/transport/cities/", form);
      }
      setModal(false);
      fetchCities();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save city");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this city?")) return;
    try {
      await api.delete(`/transport/cities/${id}/`);
      fetchCities();
    } catch { /* ignore */ }
  };

  return (
    <div className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      <PageToolbar>
        <button onClick={openCreate} className="glass-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add City
        </button>
      </PageToolbar>

      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cities.map((c, index) => (
            <div key={c.id} className="glass-card p-6 relative overflow-hidden animate-glass-fade-in"
              style={{ animationDelay: `${index * 60}ms` }}>
              {/* Gradient blob */}
              <div className="gradient-blob blob-sky w-20 h-20 -top-6 -right-6 animate-blob-float" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-semibold text-lg text-slate-800">
                      <MapPin size={16} className="shrink-0" style={{ color: "#5B8AFF" }} />
                      <span className="truncate">{c.name}</span>
                    </h3>
                    {c.state && <p className="text-sm text-slate-500 font-medium mt-0.5">{c.state}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(c)} className="p-2 hover:bg-white/50 rounded-xl text-slate-500 hover:text-accent-primary transition-all duration-200">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-50 rounded-xl text-slate-500 hover:text-red-500 transition-all duration-200">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {cities.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="No cities found"
              description="Create your first city to get started."
              className="col-span-full"
            />
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card-strong w-full max-w-md animate-glass-fade-in" style={{ borderRadius: "24px" }}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200/60">
              <h2 className="text-xl font-semibold text-slate-800">{editing ? "Edit City" : "New City"}</h2>
              <button onClick={() => setModal(false)} className="p-2 hover:bg-white/60 rounded-xl text-slate-500 hover:text-slate-800 transition-all duration-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="glass-label">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="glass-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">State</label>
                <input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="glass-label">Country</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="glass-input"
                />
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
