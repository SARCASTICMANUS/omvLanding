import React, { useState, useEffect } from "react";
import { User as UserIcon, Plus, Trash2, Edit, X, Save, Loader2, Mail, Search, FileUp, Download, CheckCircle, AlertCircle, MapPin } from "lucide-react";
import api from "../utils/api";
import AdminUsersManager from "./AdminUsersManager";

const PassengersManager = ({ universityId }) => {
    const [activeView, setActiveView] = useState("list"); // "list" or "upload"
    const [passengers, setPassengers] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [vehicleAssignments, setVehicleAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPassenger, setCurrentPassenger] = useState(null);
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        student_id: "",
        bus_pass_id: "",
        bus_pass_validity: "",
        assigned_route: "",
        assigned_vehicle: "",
        phone_number: "",
    });

    useEffect(() => {
        fetchData();
    }, [universityId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [uRes, rRes, vRes, aRes] = await Promise.all([
                api.get(`/api/users/?university=${universityId}&role=student`),
                api.get(`/api/admin/routes/?university=${universityId}`),
                api.get(`/api/vehicles/?university=${universityId}`),
                api.get(`/api/assignments/`),
            ]);
            setPassengers(uRes.data);
            setRoutes(rRes.data);
            setVehicles(vRes.data);
            setVehicleAssignments(aRes.data);
        } catch (error) {
            console.error("Error fetching passenger data:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPassengers = passengers.filter(p =>
        `${p.first_name} ${p.last_name} ${p.email} ${p.profile?.student_id || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (passenger = null) => {
        if (passenger) {
            setCurrentPassenger(passenger);
            const pr = passenger.profile || {};
            setFormData({
                first_name: passenger.first_name,
                last_name: passenger.last_name,
                email: passenger.email,
                student_id: pr.student_id || "",
                bus_pass_id: pr.bus_pass_id || "",
                bus_pass_validity: pr.bus_pass_validity || "",
                assigned_route: pr.assigned_route || "",
                assigned_vehicle: vehicleAssignments.find(a => a.student === passenger.id)?.vehicle || "",
                phone_number: pr.phone_number || "",
            });
        } else {
            setCurrentPassenger(null);
            setFormData({
                first_name: "",
                last_name: "",
                email: "",
                student_id: "",
                bus_pass_id: "",
                bus_pass_validity: "",
                assigned_route: "",
                assigned_vehicle: "",
                phone_number: "",
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentPassenger) {
                // Update User & Profile in one unified call
                await api.patch(`/api/users/${currentPassenger.id}/`, {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    student_id: formData.student_id || null,
                    bus_pass_id: formData.bus_pass_id || null,
                    bus_pass_validity: formData.bus_pass_validity || null,
                    phone_number: formData.phone_number || "",
                });

                // Sync Vehicle Assignment
                const currentAssignment = vehicleAssignments.find(a => a.student === currentPassenger.id);
                if (formData.assigned_vehicle) {
                    if (!currentAssignment) {
                        // Create new
                        await api.post("/api/assignments/", {
                            student: currentPassenger.id,
                            vehicle: formData.assigned_vehicle
                        });
                    } else if (currentAssignment.vehicle !== formData.assigned_vehicle) {
                        // Update (or Delete and Recreate since it's cleaner for many-to-many-turned-one-to-one)
                        await api.delete(`/api/assignments/${currentAssignment.id}/`);
                        await api.post("/api/assignments/", {
                            student: currentPassenger.id,
                            vehicle: formData.assigned_vehicle
                        });
                    }
                } else if (currentAssignment) {
                    // Remove existing
                    await api.delete(`/api/assignments/${currentAssignment.id}/`);
                }
            } else {
                // Create New
                await api.post("/api/auth/register/", {
                    email: formData.email,
                    password: "ChangeMe123!",
                    role: "student",
                    university: universityId,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    student_name: `${formData.first_name} ${formData.last_name}`.trim(),
                    student_id: formData.student_id || null,
                    bus_pass_id: formData.bus_pass_id || null,
                    bus_pass_validity: formData.bus_pass_validity || null,
                    phone_number: formData.phone_number || "",
                });
                // Profile is created by register serializer.
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving passenger:", error);
            alert(error.response?.data?.detail || "Failed to save passenger.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure? This removes the student account.")) {
            try {
                await api.delete(`/api/users/${id}/`);
                fetchData();
            } catch (error) {
                console.error("Error deleting student:", error);
            }
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Tab Switcher */}
            <div className="bg-white border-b border-slate-100 flex px-8 py-2 gap-8 sticky top-0 z-[10]">
                <button
                    onClick={() => setActiveView("list")}
                    className={`py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${activeView === "list" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                    Passenger List
                </button>
                <button
                    onClick={() => setActiveView("upload")}
                    className={`py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${activeView === "upload" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                    Bulk Onboarding
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                {activeView === "list" ? (
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <h1 className="text-3xl font-black text-slate-800">Passenger Ecosystem</h1>
                                <p className="text-slate-500 mt-2">Manage student & staff transit profiles.</p>
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by name, ID, email..."
                                        className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 transition shadow-sm font-medium"
                                    />
                                </div>
                                <button
                                    onClick={() => handleOpenModal()}
                                    className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition shrink-0"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <Loader2 className="animate-spin text-indigo-600" size={48} />
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student Info</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campus ID</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle & Route</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pass Status</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Settings</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredPassengers.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50/30 transition group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm uppercase">
                                                            {p.first_name?.[0] || p.email[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800 tracking-tight">{p.first_name} {p.last_name}</p>
                                                            <p className="text-xs text-slate-400 font-medium">{p.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg uppercase tracking-tight">
                                                        {p.profile?.student_id || "NOT-SET"}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase tracking-tight">
                                                                {p.profile?.assigned_vehicle_number || "NO BUS"}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin size={12} className="text-slate-400" />
                                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">
                                                                {p.profile?.assigned_route_name || "Unassigned"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    {p.boarding_eligible ? (
                                                        <span className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase">
                                                            <CheckCircle size={12} /> Valid Pass
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase">
                                                            <AlertCircle size={12} /> Expired/None
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleOpenModal(p)}
                                                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(p.id)}
                                                            className="p-2 hover:bg-red-50 rounded-xl text-red-400 transition"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : (
                    <AdminUsersManager />
                )}
            </div>

            {/* Modal - Basic Placeholder */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-xl shadow-2xl overflow-hidden p-8">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-800">{currentPassenger ? "Edit Passenger" : "Add Passenger"}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition"><X size={28} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">First Name</label>
                                    <input value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Name</label>
                                    <input value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" required />
                                </div>
                            </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Boarding Vehicle Assignment</label>
                                    <select
                                        value={formData.assigned_vehicle}
                                        onChange={e => setFormData({ ...formData, assigned_vehicle: e.target.value })}
                                        className="w-full bg-indigo-50 border-2 border-indigo-100 rounded-2xl p-4 font-bold text-sm focus:border-indigo-600 outline-none transition"
                                    >
                                        <option value="">No Vehicle Assigned</option>
                                        {vehicles.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.vehicle_number} — {v.route_name || 'Generic Path'} ({v.vehicle_type})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1 italic font-medium">Route is automatically inherited from the assigned vehicle.</p>
                                </div>

                                <div className="h-px bg-slate-100 my-4 col-span-2"></div>
                                <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4 col-span-2">Boarding Pass & ID Details</h4>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campus Student ID</label>
                                    <input 
                                        value={formData.student_id} 
                                        onChange={e => setFormData({ ...formData, student_id: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" 
                                        placeholder="STU-123456"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                                    <input 
                                        value={formData.phone_number} 
                                        onChange={e => setFormData({ ...formData, phone_number: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" 
                                        placeholder="+1 234 567 890"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bus Pass ID</label>
                                    <input 
                                        value={formData.bus_pass_id} 
                                        onChange={e => setFormData({ ...formData, bus_pass_id: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" 
                                        placeholder="BP-7890"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pass Validity Date</label>
                                    <input 
                                        type="date"
                                        value={formData.bus_pass_validity} 
                                        onChange={e => setFormData({ ...formData, bus_pass_validity: e.target.value })} 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" 
                                    />
                                </div>

                            {!currentPassenger && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" type="email" required />
                                </div>
                            )}
                            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition flex items-center justify-center gap-3">
                                <Save size={20} /> {currentPassenger ? "Save Changes" : "Register Student"}
                            </button>
                            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Profile details can be synced via bulk upload</p>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PassengersManager;
