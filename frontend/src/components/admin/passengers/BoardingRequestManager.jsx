import React, { useState, useEffect } from "react";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import {
  Ticket,
  User,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Search,
  Filter,
  RefreshCw,
  CarFront
} from "lucide-react";

const BoardingRequestManager = ({ cityId }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchRequests();
  }, [cityId]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_PATHS.operations.boardingRequests);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setRequests(data);
    } catch (e) {
      console.error("Failed to fetch boarding requests", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.post(API_PATHS.operations.boardingRequestBoarded(id), { status });
      setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const filteredRequests = requests.filter(r => 
    r.passenger_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.stop_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.vehicle_number || r.trip_bus_number || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusStyle = (status) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-600 border-amber-200";
      case "approaching": return "bg-blue-100 text-blue-600 border-blue-200";
      case "boarded": return "bg-green-100 text-green-600 border-green-200";
      case "completed": return "bg-slate-100 text-slate-600 border-slate-200";
      case "cancelled": return "bg-red-100 text-red-600 border-red-200";
      default: return "bg-slate-100 text-slate-400";
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans">
      <div className="p-8 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
              <Ticket className="text-indigo-600" size={32} /> Ride Requests
            </h1>
            <p className="text-slate-500 font-bold mt-1">
              Manage pickup requests and ride status
            </p>
          </div>
          <button 
            onClick={fetchRequests}
            className={`p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-100 transition ${loading ? "animate-spin" : ""}`}
          >
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by passenger, stop or vehicle number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium"
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition">
            <Filter size={16} /> Filter
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Passenger</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Route / Vehicle</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pickup Stop</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <User size={18} />
                      </div>
                      <div>
                        <div className="font-black text-slate-900">{r.passenger_name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">ID: {r.passenger?.substring(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <CarFront size={14} className="text-indigo-500" />
                      <span className="font-bold text-slate-700">{r.vehicle_number || r.trip_bus_number || "Ride"}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400" />
                      <span className="font-bold text-slate-700">{r.stop_name}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyle(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock size={14} />
                      <span className="text-xs font-bold">{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      {r.status === "pending" && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(r.id, "approaching")}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition"
                            title="Mark Approaching"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(r.id, "cancelled")}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition"
                            title="Cancel Request"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-200 transition">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRequests.length === 0 && (
            <div className="p-12 text-center text-slate-400 font-bold">
              No matching requests found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardingRequestManager;
