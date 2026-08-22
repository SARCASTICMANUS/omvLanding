import React, { useState, useEffect } from "react";
import { User as UserIcon, Plus, Trash2, Edit, ShieldCheck, X, Save, Loader2, Mail, Phone, Info } from "lucide-react";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";

const DriversManager = ({ cityId }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentDriver, setCurrentDriver] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    license_number: "",
    vehicle_number: "",
    vehicle_type: "bus",
  });

  useEffect(() => {
    fetchData();
  }, [cityId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const uRes = await api.get(`${API_PATHS.admin.users}?city=${cityId}&role=driver`);
      const data = Array.isArray(uRes.data) ? uRes.data : uRes.data.results || [];
      setDrivers(data);
    } catch (error) {
      console.error("Error fetching driver data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (driver = null) => {
    if (driver) {
      setCurrentDriver(driver);
      const profile = driver.profile || {};
      setFormData({
        email: driver.email,
        first_name: driver.first_name,
        last_name: driver.last_name,
        license_number: profile.license_number || "",
        vehicle_number: profile.vehicle_number || "",
        vehicle_type: profile.vehicle_type || "bus",
      });
    } else {
      setCurrentDriver(null);
      setFormData({
        email: "",
        first_name: "",
        last_name: "",
        license_number: "",
        vehicle_number: "",
        vehicle_type: "bus",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentDriver) {
        // We only allow name updates from the frontend easily
        // Usually, profile updates require a specific endpoint but we'll stick to user logic for this MVP
        await api.patch(API_PATHS.admin.userDetail(currentDriver.id), {
          first_name: formData.first_name,
          last_name: formData.last_name,
        });
      } else {
        await api.post(API_PATHS.auth.register, {
            email: formData.email,
            password: "ChangeMe123!",
            role: "driver",
            city: cityId,
            first_name: formData.first_name,
            last_name: formData.last_name,
            license_number: formData.license_number,
            vehicle_type: formData.vehicle_type,
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving driver:", error);
      alert(error.response?.data?.detail || "Failed to save driver details.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this driver?")) {
      try {
        await api.delete(API_PATHS.admin.userDetail(id));
        fetchData();
      } catch (error) {
        console.error("Error deleting driver:", error);
      }
    }
  };

  return (
    <div className="p-8 h-full bg-slate-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800">Driver Management</h1>
            <p className="text-slate-500 mt-2">Manage driver profiles and licenses.</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
          >
            <Plus size={20} /> Onboard New Driver
          </button>
        </div>

        {loading ? (
           <div className="flex justify-center items-center h-64">
             <Loader2 className="animate-spin text-indigo-600" size={48} />
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {drivers.map((d) => (
              <div key={d.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                        <button onClick={() => handleDelete(d.id)} className="p-2 hover:bg-red-50 rounded-xl text-red-500">
                          <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    <UserIcon size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{d.first_name} {d.last_name}</h3>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                      <ShieldCheck size={10} /> Verified Driver
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-500">
                    <Mail size={14} className="shrink-0" />
                    <span className="text-xs font-medium truncate">{d.email}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-50 space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium tracking-tight">License</span>
                        <span className="text-slate-700 font-black">{d.profile?.license_number || "PENDING"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium tracking-tight">Vehicle #</span>
                        <span className="text-indigo-600 font-black uppercase">{d.profile?.vehicle_number || "UNASSIGNED"}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium tracking-tight">Route</span>
                        <span className="text-slate-700 font-bold uppercase truncate max-w-[120px]">{d.profile?.assigned_route_name || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {drivers.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                   <Info className="mx-auto text-slate-300 mb-2" size={32} />
                   <p className="text-slate-400 font-bold">No drivers found for this city.</p>
                </div>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">{currentDriver ? "Update Driver Profile" : "Onboard New Driver"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {!currentDriver && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="driver@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-sm"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
                    <input
                        required
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-sm"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
                    <input
                        required
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-sm"
                    />
                </div>
              </div>

              <div className="h-px bg-slate-100 my-4"></div>
              <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest">Professional Details</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">License Number</label>
                    <input
                        value={formData.license_number}
                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                        placeholder="DL-XXXXXXXX"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-sm uppercase"
                    />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Type (Req)</label>
                  <select
                    value={formData.vehicle_type}
                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition font-bold text-sm"
                  >
                    <option value="bus">Bus</option>
                    <option value="van">Van</option>
                    <option value="minibus">Minibus</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl mt-6 flex items-center justify-center gap-2"
              >
                <Save size={18} /> {currentDriver ? "Sync Profile Changes" : "Register Driver Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversManager;
