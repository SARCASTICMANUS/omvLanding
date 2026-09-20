import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, MapPin } from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";
import EmptyState from "../components/EmptyState";

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
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="memphis-title">Cities</h1>
          <p className="text-memphis-purple mt-2 font-medium">Manage operational cities</p>
        </div>
        <button onClick={openCreate} className="memphis-btn-primary flex items-center gap-2">
          <Plus size={18} /> Add City
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cities.map((c) => (
            <div key={c.id} className="memphis-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="memphis-icon-tile bg-memphis-teal">
                  <MapPin size={20} className="text-memphis-ink" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-2 hover:bg-memphis-ink/5 rounded-lg text-memphis-purple transition-all duration-200">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-memphis-coral/10 rounded-lg text-memphis-coral transition-all duration-200">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-memphis-ink">{c.name}</h3>
              {c.state && <p className="text-sm text-memphis-purple font-medium">{c.state}</p>}
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
        <div className="fixed inset-0 bg-memphis-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-memphis-paper border-2 border-memphis-ink rounded-xl w-full max-w-md shadow-memphis-lg">
            <div className="flex items-center justify-between p-6 border-b-2 border-memphis-ink">
              <h2 className="text-xl font-bold text-memphis-ink">{editing ? "Edit City" : "New City"}</h2>
              <button onClick={() => setModal(false)} className="text-memphis-purple hover:text-memphis-ink transition-all duration-200">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="memphis-label">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="memphis-input"
                />
              </div>
              <div className="space-y-1">
                <label className="memphis-label">State</label>
                <input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="memphis-input"
                />
              </div>
              <div className="space-y-1">
                <label className="memphis-label">Country</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="memphis-input"
                />
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
