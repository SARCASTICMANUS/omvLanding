import React, { useState, useEffect } from "react";
import { X, Search, UserPlus, Trash2, Loader2, UserCheck } from "lucide-react";
import api from "../utils/api";

const VehicleAssignmentModal = ({ vehicle, universityId, onClose }) => {
    const [assignments, setAssignments] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, [vehicle.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assignRes, studentRes] = await Promise.all([
                api.get(`/api/assignments/?vehicle=${vehicle.id}`),
                api.get(`/api/users/?university=${universityId}&role=student`)
            ]);
            setAssignments(assignRes.data);
            setAllStudents(studentRes.data);
        } catch (error) {
            console.error("Error fetching assignment data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (studentId) => {
        setSubmitting(true);
        try {
            await api.post("/api/assignments/", {
                student: studentId,
                vehicle: vehicle.id
            });
            await fetchData();
        } catch (error) {
            console.error("Error assigning student:", error);
            alert(error.response?.data?.non_field_errors?.[0] || "Failed to assign student.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUnassign = async (assignmentId) => {
        setSubmitting(true);
        try {
            await api.delete(`/api/assignments/${assignmentId}/`);
            await fetchData();
        } catch (error) {
            console.error("Error unassigning student:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const assignedStudentIds = assignments.map(a => a.student);
    
    const filteredStudents = allStudents.filter(s => 
        `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Manage Passenger Assignments</h2>
                        <p className="text-slate-400 text-sm mt-1">Vehicle: <span className="text-indigo-400 font-bold uppercase">{vehicle.vehicle_number}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
                        <X size={28} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex list-none">
                    {/* Left Panel: All Students */}
                    <div className="w-1/2 border-r border-slate-100 flex flex-col">
                        <div className="p-6 bg-slate-50/50">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Available Students</h3>
                            <div className="relative">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search students..."
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm outline-none focus:ring-4 focus:ring-indigo-600/5 transition font-medium"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loading ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
                            ) : filteredStudents.length === 0 ? (
                                <p className="text-center text-slate-400 py-8 text-sm">No students found.</p>
                            ) : (
                                filteredStudents.map(student => {
                                    const isAssigned = assignedStudentIds.includes(student.id);
                                    return (
                                        <div key={student.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${isAssigned ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isAssigned ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                    {student.first_name?.[0] || student.email[0]}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800 tracking-tight">{student.first_name} {student.last_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{student.email}</p>
                                                </div>
                                            </div>
                                            {!isAssigned && (
                                                <button 
                                                    onClick={() => handleAssign(student.id)}
                                                    disabled={submitting}
                                                    className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
                                                >
                                                    <UserPlus size={16} />
                                                </button>
                                            )}
                                            {isAssigned && <UserCheck size={18} className="text-indigo-600 mr-2" />}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Current Assignments */}
                    <div className="w-1/2 flex flex-col bg-slate-50/20">
                        <div className="p-6 border-b border-slate-100 shrink-0">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Currently Assigned ({assignments.length})</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {loading ? (
                                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-600" /></div>
                            ) : assignments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                        <UserPlus size={32} />
                                    </div>
                                    <p className="text-sm font-medium">No students assigned yet.</p>
                                    <p className="text-xs mt-1">Select students from the left to assign them to this vehicle.</p>
                                </div>
                            ) : (
                                assignments.map(a => (
                                    <div key={a.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition hover:border-rose-100 hover:shadow-md group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs">
                                                {a.student_name?.[0] || '?'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 tracking-tight">{a.student_name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">{a.student_id || 'ID UNSET'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleUnassign(a.id)}
                                            disabled={submitting}
                                            className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-50 text-rose-500 rounded-xl transition disabled:opacity-50"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0 flex justify-between items-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assignment data is synced with real-time fleet analytics</p>
                    <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-900 transition shadow-lg">Done</button>
                </div>
            </div>
        </div>
    );
};

export default VehicleAssignmentModal;
