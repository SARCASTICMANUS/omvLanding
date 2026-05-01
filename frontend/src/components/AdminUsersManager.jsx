import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { Plus, X, Search, Building, Trash2 } from "lucide-react";

const AdminUsersManager = () => {
    const [view, setView] = useState("list"); // "list", "create"
    const [users, setUsers] = useState([]);
    const [cities, setCities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const [formData, setFormData] = useState({
        city: "",
        first_name: "",
        last_name: "",
        email: "",
        role: "passenger",
    });

    useEffect(() => {
        fetchData();
        fetchCities();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/users/");
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCities = async () => {
        try {
            const res = await api.get("/api/cities/");
            const data = Array.isArray(res.data) ? res.data : res.data.results || [];
            setCities(data);
        } catch (error) {
            console.error("Error fetching cities:", error);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await api.post("/api/auth/register/", {
                ...formData,
                password: "ChangeMe123!",
            });
            setView("list");
            fetchData();
            setFormData({ email: "", first_name: "", last_name: "", role: "passenger", city: "" });
        } catch (err) {
            alert(err.response?.data?.error || "Error creating user.");
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm("Delete this user?")) {
            try {
                await api.delete(`/api/users/${id}/`);
                fetchData();
            } catch (err) {
                alert("Error deleting user.");
            }
        }
    };

    const filteredUsers = Array.isArray(users) ? users.filter(u =>
        `${u.first_name} ${u.last_name} ${u.email} ${u.role}`.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto">
            <div className="max-w-6xl mx-auto">

                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Access Control</h1>
                        <p className="text-slate-500 mt-2 font-medium">Manage administrators, staff, and passengers.</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setView("create")}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                        >
                            <Plus size={20} /> Create New User
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {view === "list" && (
                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <div className="relative w-96">
                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, email, or role..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/5 transition font-medium"
                                    />
                                </div>
                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">
                                    Total Users: {users.length}
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex justify-center items-center h-64">
                                    <div className="animate-spin text-indigo-600 border-2 border-indigo-600 border-t-transparent rounded-full w-8 h-8" />
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-50">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Profile</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Role</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">City</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50/50 transition duration-200 group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs uppercase">
                                                            {u.first_name?.[0] || u.email[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{u.first_name} {u.last_name}</p>
                                                            <p className="text-xs text-slate-400 font-medium">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${u.role === "admin" ? "bg-rose-50 text-rose-600" :
                                                        u.role === "city_admin" ? "bg-indigo-50 text-indigo-600" :
                                                            u.role === "driver" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                                                        }`}>
                                                        {u.role.replace("_", " ")}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Building size={14} className="text-slate-400" />
                                                        <span className="text-sm font-bold tracking-tight">{u.city_name || "GLOBAL"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition duration-200">
                                                        <button onClick={() => handleDeleteUser(u.id)} className="p-2.5 hover:bg-rose-50 rounded-xl text-rose-500 transition">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {view === "create" && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[2000] flex items-center justify-center p-6">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden">
                                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight">Onboard New Staff / Admin</h2>
                                        <p className="text-slate-400 text-sm mt-1">Manual account creation for system roles.</p>
                                    </div>
                                    <button onClick={() => setView("list")} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
                                        <X size={28} />
                                    </button>
                                </div>
                                <form onSubmit={handleCreateUser} className="p-10 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">First Name</label>
                                            <input
                                                required
                                                placeholder="e.g. Michael"
                                                value={formData.first_name}
                                                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Last Name</label>
                                            <input
                                                required
                                                placeholder="e.g. Scott"
                                                value={formData.last_name}
                                                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            placeholder="michael@vayy.com"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">System Role</label>
                                            <select
                                                value={formData.role}
                                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            >
                                                <option value="passenger">Passenger</option>
                                                <option value="driver">Driver</option>
                                                <option value="city_admin">City Admin</option>
                                                <option value="admin">Global Super Admin</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Link to City</label>
                                            <select
                                                required={formData.role !== "admin"}
                                                value={formData.city}
                                                onChange={e => setFormData({ ...formData, city: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            >
                                                <option value="">Select City</option>
                                                {cities.map(city => (
                                                    <option key={city.id} value={city.id}>{city.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all transform active:scale-[0.98] uppercase tracking-widest mt-4"
                                    >
                                        Create Account
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminUsersManager;
