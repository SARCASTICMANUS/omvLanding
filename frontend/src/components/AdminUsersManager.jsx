// VAYY | src/components/AdminUsersManager.jsx | Status: 🔧 Upgraded
// Reason: Added user listing and manual creation (for University Admins etc) + existing bulk upload.

import React, { useState, useEffect } from "react";
import api from "../utils/api";
import { Upload, FileDown, CheckCircle, AlertOctagon, Loader, Users, Plus, X, Search, Building, Mail, ShieldCheck, Trash2, Edit } from "lucide-react";

const AdminUsersManager = () => {
    // UI state
    const [view, setView] = useState("list"); // "list", "create", "bulk"
    const [users, setUsers] = useState([]);
    const [universities, setUniversities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Create User Form state
    const [formData, setFormData] = useState({
        university: "",
        student_id: "",
        bus_pass_id: "",
        bus_pass_validity: "",
        phone_number: "",
    });

    // Bulk Upload state
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [resResult, setResResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        fetchData();
        fetchUniversities();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/users/");
            setUsers(res.data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUniversities = async () => {
        try {
            const res = await api.get("/api/universities/");
            setUniversities(res.data);
        } catch (error) {
            console.error("Error fetching universities:", error);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            // Using the auth register endpoint for consistency
            await api.post("/api/auth/register/", {
                ...formData,
                password: "ChangeMe123!", // System default for new admins
            });
            setView("list");
            fetchData();
            setFormData({ email: "", first_name: "", last_name: "", role: "student", university: "" });
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

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setResResult(null);
            setErrorMsg("");
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        setResResult(null);
        setErrorMsg("");

        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        try {
            const res = await api.post("/api/admin/students/bulk-upload/", formDataUpload, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            setResResult({
                success_count: res.data.success_count,
                error_count: res.data.error_count,
                task_id: res.data.task_id,
                message: res.data.message
            });
            setFile(null);
            fetchData();
        } catch (err) {
            setErrorMsg(err.response?.data?.error || "An error occurred during upload.");
        } finally {
            setIsUploading(false);
        }
    };

    const filteredUsers = users.filter(u => 
        `${u.first_name} ${u.last_name} ${u.email} ${u.role}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 h-full bg-slate-50 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                
                {/* Header */}
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">System Access Control</h1>
                        <p className="text-slate-5100 mt-2 font-medium">Manage administrators, staff, and student transit accounts.</p>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setView("bulk")}
                            className={`px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition duration-300 ${view === "bulk" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
                        >
                            <Upload size={18}/> Bulk Student Upload
                        </button>
                        <button 
                            onClick={() => setView("create")}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                        >
                            <Plus size={20} /> Create New User
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 gap-8">
                    
                    {/* View: User List */}
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
                                    <Loader className="animate-spin text-indigo-600" size={32} />
                                </div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-50">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Profile</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Role</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Institution</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredUsers.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50/50 transition duration-200 group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs">
                                                            {u.first_name?.[0] || u.email[0]}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{u.first_name} {u.last_name}</p>
                                                            <p className="text-xs text-slate-400 font-medium">{u.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                                        u.role === "admin" ? "bg-rose-50 text-rose-600" :
                                                        u.role === "university_admin" ? "bg-indigo-50 text-indigo-600" :
                                                        u.role === "driver" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {u.role.replace("_", " ")}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Building size={14} className="text-slate-400" />
                                                        <span className="text-sm font-bold tracking-tight">{u.university_name || "GLOBAL"}</span>
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

                    {/* View: Create User Modal/View */}
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
                                                onChange={e => setFormData({...formData, first_name: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Last Name</label>
                                            <input 
                                                required
                                                placeholder="e.g. Scott"
                                                value={formData.last_name}
                                                onChange={e => setFormData({...formData, last_name: e.target.value})}
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
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">System Role</label>
                                            <select 
                                                value={formData.role}
                                                onChange={e => setFormData({...formData, role: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            >
                                                <option value="student">Student / Passenger</option>
                                                <option value="driver">Driver</option>
                                                <option value="university_admin">University Admin</option>
                                                <option value="admin">Global Super Admin</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Link to University</label>
                                            <select 
                                                required={formData.role !== "admin"}
                                                value={formData.university}
                                                onChange={e => setFormData({...formData, university: e.target.value})}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                            >
                                                <option value="">Select University</option>
                                                {universities.map(univ => (
                                                    <option key={univ.id} value={univ.id}>{univ.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {formData.role === "student" && (
                                        <>
                                            <div className="h-px bg-slate-100 my-4 col-span-2"></div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Student ID</label>
                                                    <input 
                                                        placeholder="STU-123"
                                                        value={formData.student_id}
                                                        onChange={e => setFormData({...formData, student_id: e.target.value})}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                                                    <input 
                                                        placeholder="+1..."
                                                        value={formData.phone_number}
                                                        onChange={e => setFormData({...formData, phone_number: e.target.value})}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Bus Pass ID</label>
                                                    <input 
                                                        placeholder="PASS-001"
                                                        value={formData.bus_pass_id}
                                                        onChange={e => setFormData({...formData, bus_pass_id: e.target.value})}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pass Validity</label>
                                                    <input 
                                                        type="date"
                                                        value={formData.bus_pass_validity}
                                                        onChange={e => setFormData({...formData, bus_pass_validity: e.target.value})}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-600 transition font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <button 
                                        type="submit"
                                        className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-2xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all transform active:scale-[0.98] uppercase tracking-widest"
                                    >
                                        Create Account & Notify
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* View: Bulk Upload */}
                    {view === "bulk" && (
                        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[2000] flex items-center justify-center p-6">
                            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden">
                                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight">Bulk Transit Onboarding</h2>
                                        <p className="text-slate-400 text-sm mt-1">Upload rosters to sync student data.</p>
                                    </div>
                                    <button onClick={() => setView("list")} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
                                        <X size={28} />
                                    </button>
                                </div>
                                <div className="p-10 space-y-8">
                                    <div className="bg-indigo-600/5 p-6 rounded-3xl border border-indigo-600/10 flex items-start gap-4">
                                        <div className="bg-indigo-600 p-2.5 rounded-xl text-white">
                                            <ShieldCheck size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-indigo-900">Security Note</h4>
                                            <p className="text-xs text-indigo-700 mt-1 leading-relaxed">Students will receive a real-time OTP for activation once their records are synced via the CSV/Excel sheet.</p>
                                        </div>
                                    </div>

                                    <label className="border-4 border-dashed border-slate-200 bg-slate-50 rounded-[2rem] p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-indigo-400 transition-all group group relative">
                                        <Upload size={48} className="text-slate-300 group-hover:text-indigo-500 mb-4 transition-colors" />
                                        <span className="text-lg font-black text-slate-700 group-hover:text-indigo-700 tracking-tight">
                                            {file ? file.name : "Select Spreadsheet"}
                                        </span>
                                        <span className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Supports CSV, XLSX up to 10MB</span>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept=".csv, .xlsx"
                                            onChange={handleFileChange}
                                        />
                                    </label>

                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => {
                                                const headers = "student_name,student_id,email,bus_pass_id,bus_pass_validity,phone_number,vehicle_number\n";
                                                const sample = "John Doe,STU12345,john@university.edu,PASS-998,2025-12-31,+123456789,BUS-001";
                                                const blob = new Blob([headers + sample], { type: 'text/csv' });
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = 'vayy_template.csv';
                                                a.click();
                                            }}
                                            className="font-black text-xs uppercase tracking-widest text-slate-400 hover:text-indigo-600 flex items-center gap-2 px-4"
                                        >
                                            <FileDown size={14}/> Template
                                        </button>
                                        <button
                                            onClick={handleUpload}
                                            disabled={!file || isUploading}
                                            className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition disabled:bg-slate-300 disabled:shadow-none uppercase tracking-widest flex justify-center items-center gap-2"
                                        >
                                            {isUploading ? <><Loader className="animate-spin" size={20}/> Processing...</> : "Start Sync Process"}
                                        </button>
                                    </div>

                                    {errorMsg && (
                                        <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-100 text-xs font-bold flex gap-3 items-center">
                                            <AlertOctagon size={16} />
                                            <span>{errorMsg}</span>
                                        </div>
                                    )}

                                    {resResult && (
                                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <CheckCircle size={20} className="text-emerald-500" />
                                                <span className="font-bold text-emerald-800 text-sm">Success: {resResult.success_count} Created</span>
                                            </div>
                                            <span className="text-xs text-emerald-600 font-medium">{resResult.message}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminUsersManager;
