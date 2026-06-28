import React, { useState, useEffect } from "react";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import {
  Activity,
  MapPin,
  Clock,
  User,
  Bus,
  RefreshCw,
  MoreVertical,
  AlertCircle,
  CheckCircle2,
  Navigation
} from "lucide-react";

const ActiveTripManager = ({ cityId }) => {
  const [activeTrips, setActiveTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchActiveTrips();
    const interval = setInterval(fetchActiveTrips, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [cityId]);

  const fetchActiveTrips = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_PATHS.operations.trips);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setActiveTrips(data);
    } catch (e) {
      console.error("Failed to fetch active trips", e);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrips = activeTrips.filter(trip => {
    if (filter === "all") return true;
    return trip.status === filter;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans">
      <div className="p-8 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
            <Activity className="text-indigo-600" size={32} /> Active Operations
          </h1>
          <p className="text-slate-500 font-bold mt-1">
            Real-time fleet state and trip monitoring
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1">
            {["all", "active", "inactive"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${filter === f
                    ? "bg-white text-indigo-600 shadow-md"
                    : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={fetchActiveTrips}
            className={`p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition ${loading ? "animate-spin" : ""}`}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {filteredTrips.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Navigation size={64} className="mb-4 opacity-10 animate-pulse" />
            <p className="text-lg font-bold">No active trips found in this sector</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-[32px] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 group overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                        <Bus size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 tracking-tight">{trip.bus_number || "Bus N/A"}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{trip.route_name}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${trip.status === "active" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${trip.status === "active" ? "bg-green-500 animate-ping" : "bg-slate-400"}`}></div>
                      {trip.status}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-600">
                      <User size={16} className="text-slate-400" />
                      <span className="text-sm font-bold">Driver ID: {trip.driver}...</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <Clock size={16} className="text-slate-400" />
                      <span className="text-sm font-bold">Started: {new Date(trip.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      <AlertCircle size={16} className={trip.delay_minutes > 5 ? "text-red-500" : "text-green-500"} />
                      <span className="text-sm font-bold">Status: {trip.delay_minutes > 0 ? `${trip.delay_minutes} min delay` : "On schedule"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center group-hover:bg-indigo-50/50 transition-colors">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 shadow-sm">
                        <User size={12} />
                      </div>
                    ))}
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm">
                      +5
                    </div>
                  </div>
                  <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition flex items-center gap-1">
                    Live Tracking <Navigation size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveTripManager;
