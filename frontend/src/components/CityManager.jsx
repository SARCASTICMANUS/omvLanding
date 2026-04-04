import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { Plus, Edit2, Trash2, MapPin, School, Save, X } from "lucide-react";

const CityManager = () => {
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [formData, setFormData] = useState({ name: "" });

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/cities/");
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCities(data);
    } catch (e) {
      console.error("Failed to fetch cities", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingCity) {
        await api.put(`/api/cities/${editingCity.id}/`, formData);
      } else {
        await api.post("/api/cities/", formData);
      }
      setShowModal(false);
      setEditingCity(null);
      setFormData({ name: "" });
      fetchCities();
    } catch (e) {
      console.error("Failed to save city", e);
      alert("Error saving city. Details in console.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this city?"))
      return;
    try {
      await api.delete(`/api/cities/${id}/`);
      fetchCities();
    } catch (e) {
      console.error("Failed to delete city", e);
    }
  };

  const openEdit = (city) => {
    setEditingCity(city);
    setFormData({ name: city.name });
    setShowModal(true);
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">
            City Management
          </h1>
          <p className="text-slate-500 font-medium">
            Add and manage operational cities
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCity(null);
            setFormData({ name: "" });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
        >
          <Plus size={20} /> Add City
        </button>
      </div>

      {loading && !cities.length ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cities && cities.map((city) => (
            <div
              key={city.id}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <MapPin size={24} />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(city)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(city.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">
                {city.name}
              </h3>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden scale-in-center">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                {editingCity ? "Edit City" : "New City"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  City Name
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-semibold"
                  placeholder="e.g. New York, Delhi"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-200 flex justify-center items-center gap-2"
              >
                <Save size={18} /> {loading ? "Saving..." : "Save City"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityManager;
