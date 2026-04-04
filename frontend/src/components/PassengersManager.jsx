import React, { useState, useEffect } from "react";
import { User as UserIcon, Plus, Trash2, Edit, X, Save, Loader2, Search, MapPin } from "lucide-react";
import api from "../utils/api";

const PassengersManager = ({ cityId }) => {
    const [passengers, setPassengers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPassenger, setCurrentPassenger] = useState(null);
    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone_number: "",
    });

    useEffect(() => {
        fetchData();
    }, [cityId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/users/?city=${cityId}&role=passenger`);
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            setPassengers(data);
        } catch (error) {
            console.error("Error fetching passenger data:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredPassengers = passengers.filter(p =>
        `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (passenger = null) => {
        if (passenger) {
            setCurrentPassenger(passenger);
            const pr = passenger.profile || {};
            setFormData({
                first_name: passenger.first_name,
                last_name: passenger.last_name,
                email: passenger.email,
                phone_number: pr.phone_number || "",
            });
        } else {
            setCurrentPassenger(null);
            setFormData({
                first_name: "",
                last_name: "",
                email: "",
                phone_number: "",
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (currentPassenger) {
                await api.patch(`/api/users/${currentPassenger.id}/`, {
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                });
            } else {
                await api.post("/api/auth/register/", {
                    email: formData.email,
                    password: "ChangeMe123!",
                    role: "passenger",
                    city: cityId,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone_number: formData.phone_number || "",
                });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error("Error saving passenger:", error);
            alert(error.response?.data?.detail || "Failed to save passenger.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure? This removes the passenger account.")) {
            try {
                await api.delete(`/api/users/${id}/`);
                fetchData();
            } catch (error) {
                console.error("Error deleting passenger:", error);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-800">Public Passengers</h1>
                            <p className="text-slate-500 mt-2">Manage open-access public passenger profiles.</p>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-64">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search passengers..."
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
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Passenger Info</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</th>
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
                                                <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                                                    {p.profile?.phone_number || "NO PHONE"}
                                                </span>
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
            </div>

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
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</label>
                                <input 
                                    value={formData.phone_number} 
                                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })} 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" 
                                    placeholder="+1 234 567 890"
                                />
                            </div>

                            {!currentPassenger && (
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Address</label>
                                    <input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-600/20 outline-none" type="email" required />
                                </div>
                            )}
                            <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition flex items-center justify-center gap-3">
                                <Save size={20} /> {currentPassenger ? "Save Changes" : "Register Passenger"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PassengersManager;
