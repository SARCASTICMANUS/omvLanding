import React, { useState, useEffect } from "react";
import { Bus, Plus, Trash2, Edit, X, Save, Loader2 } from "lucide-react";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";

const VehiclesManager = ({ cityId }) => {
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  const [formData, setFormData] = useState({
    vehicle_number: "",
    vehicle_type: "bus",
    route: "",
    driver: "",
  });

  useEffect(() => {
    fetchData();
  }, [cityId]);

  const fetchData = async () => {
    if (!cityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [vRes, rRes, dRes] = await Promise.all([
        api.get(`${API_PATHS.operations.vehicles}?city=${cityId}`),
        api.get(`${API_PATHS.admin.routes}?city=${cityId}`),
        api.get(`${API_PATHS.admin.users}?city=${cityId}&role=driver`),
      ]);
      setVehicles(Array.isArray(vRes.data) ? vRes.data : vRes.data.results || []);
      setRoutes(Array.isArray(rRes.data) ? rRes.data : rRes.data.results || []);
      setDrivers(Array.isArray(dRes.data) ? dRes.data : dRes.data.results || []);
    } catch (error) {
      console.error("Error fetching vehicle data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (vehicle = null) => {
    if (vehicle) {
      setCurrentVehicle(vehicle);
      setFormData({
        vehicle_number: vehicle.vehicle_number,
        vehicle_type: vehicle.vehicle_type,
        route: vehicle.route || "",
        driver: vehicle.driver || "",
      });
    } else {
      setCurrentVehicle(null);
      setFormData({
        vehicle_number: "",
        vehicle_type: "bus",
        route: "",
        driver: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, city: cityId };
    try {
      if (currentVehicle) {
        await api.put(API_PATHS.operations.vehicleDetail(currentVehicle.id), payload);
      } else {
        await api.post(API_PATHS.operations.vehicles, payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving vehicle:", error);
      alert(error.response?.data?.detail || "Failed to save vehicle.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this vehicle?")) {
      try {
        await api.delete(API_PATHS.operations.vehicleDetail(id));
        fetchData();
      } catch (error) {
        console.error("Error deleting vehicle:", error);
      }
    }
  };

  return (
    <div className="p-8 h-full bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Vehicle Management</h1>
            <p className="text-slate-500 mt-2">Manage city public transport vehicles.</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
          >
            <Plus size={20} /> Add New Vehicle
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Detail</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Route</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vehicles.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                          <Bus size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 uppercase">{v.vehicle_number}</p>
                          <p className="text-xs text-slate-400">ID: {v.id.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">{v.vehicle_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{v.route_name || "Unassigned"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{v.driver_name || "Unassigned"}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenModal(v)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(v.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vehicles.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium">
                      No vehicles found. Add your first vehicle to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">{currentVehicle ? "Edit Vehicle" : "Add Vehicle"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Number</label>
                <input
                  required
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="e.g. PB-01-AX-1234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-slate-800 uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-slate-800"
                  >
                    <option value="bus">Bus</option>
                    <option value="van">Van</option>
                    <option value="minibus">Minibus</option>
                    <option value="car">Car</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Route</label>
                <select
                  value={formData.route}
                  onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-slate-800"
                >
                  <option value="">No Route Selected</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} {r.bus_number ? `(${r.bus_number})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Driver</label>
                <select
                  value={formData.driver}
                  onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-slate-800"
                >
                  <option value="">No Driver Selected</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.first_name} {d.last_name} ({d.email})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl mt-4 flex items-center justify-center gap-2"
              >
                <Save size={18} /> {currentVehicle ? "Update Vehicle" : "Create Vehicle"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehiclesManager;
