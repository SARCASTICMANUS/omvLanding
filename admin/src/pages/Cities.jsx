import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, Save, X, MapPin } from "lucide-react";
import api from "../api/client";

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
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">Cities</h1>
          <p className="text-slate-500 mt-1 font-medium">Manage operational cities</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-brand-700 transition shadow-lg shadow-brand-600/25"
        >
          <Plus size={18} /> Add City
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cities.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-11 h-11 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
                  <MapPin size={22} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => openEdit(c)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                    <Edit3 size={15} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <h3 className="font-bold text-lg text-slate-800">{c.name}</h3>
              {c.state && <p className="text-sm text-slate-400 font-medium">{c.state}</p>}
            </div>
          ))}
          {cities.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-400 font-medium">
              No cities found. Create your first one.
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold">{editing ? "Edit City" : "New City"}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">State</label>
                <input
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Country</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-600/20 outline-none"
                />
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
