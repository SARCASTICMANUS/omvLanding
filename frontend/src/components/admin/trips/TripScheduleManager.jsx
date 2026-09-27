import React, { useCallback, useState, useEffect } from "react";
/* eslint-disable react-hooks/set-state-in-effect */
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import {
  Clock,
  Plus,
  Trash2,
  Calendar,
  Save,
  Route as RouteIcon,
  Timer,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowRight
} from "lucide-react";

const TripScheduleManager = ({ cityId }) => {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [stopTimes, setStopTimes] = useState([]);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    label: "",
    scheduled_start_time: "08:00:00",
    is_active: true
  });

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await api.get(`${API_PATHS.admin.routes}${cityId ? `?city=${cityId}` : ""}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setRoutes(data);
    } catch (e) {
      console.error("Failed to fetch routes", e);
    }
  }, [cityId]);

  const fetchSchedules = useCallback(async (routeId) => {
    try {
      const res = await api.get(`${API_PATHS.transport.schedules}?route=${routeId}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSchedules(data);
    } catch (e) {
      console.error("Failed to fetch schedules", e);
    }
  }, []);

  const fetchStopTimes = useCallback(async (scheduleId) => {
    try {
      const res = await api.get(`${API_PATHS.transport.stopTimes}?trip_schedule=${scheduleId}`);
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      // Sort by sequence
      const sorted = [...data].sort((a, b) => a.stop_sequence - b.stop_sequence);
      setStopTimes(sorted);
    } catch (e) {
      console.error("Failed to fetch stop times", e);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    if (selectedRoute) {
      fetchSchedules(selectedRoute.id);
    } else {
      setSchedules([]);
      setSelectedSchedule(null);
    }
  }, [fetchSchedules, selectedRoute]);

  useEffect(() => {
    if (selectedSchedule) {
      fetchStopTimes(selectedSchedule.id);
    } else {
      setStopTimes([]);
    }
  }, [fetchStopTimes, selectedSchedule]);

  const handleAddSchedule = async () => {
    if (!selectedRoute || !newSchedule.label) return;
    try {
      const res = await api.post(API_PATHS.admin.tripSchedules, {
        ...newSchedule,
        route: selectedRoute.id
      });
      setSchedules([...schedules, res.data]);
      setShowAddSchedule(false);
      setNewSchedule({ label: "", scheduled_start_time: "08:00:00", is_active: true });
      
      // Automatically create default StopTimes based on route stops
      await createDefaultStopTimes(res.data, selectedRoute.stops);
    } catch (e) {
      console.error("Failed to add schedule", e);
    }
  };

  const createDefaultStopTimes = async (schedule, stops) => {
    // Basic implementation: just create entries, user can edit times later
    for (let i = 0; i < stops.length; i++) {
      try {
        await api.post(API_PATHS.admin.stopTimes, {
          trip_schedule: schedule.id,
          stop: stops[i].id,
          arrival_time: schedule.scheduled_start_time, // Placeholder
          stop_sequence: i
        });
      } catch (e) {
        console.error("Failed to create stop time", e);
      }
    }
    fetchStopTimes(schedule.id);
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm("Are you sure? This will delete all associated stop times.")) return;
    try {
      await api.delete(API_PATHS.transport.scheduleDetail(id));
      setSchedules(schedules.filter(s => s.id !== id));
      if (selectedSchedule?.id === id) setSelectedSchedule(null);
    } catch (e) {
      console.error("Failed to delete schedule", e);
    }
  };

  const handleUpdateStopTime = async (stopTimeId, data) => {
    try {
      const res = await api.patch(API_PATHS.transport.stopTimeDetail(stopTimeId), data);
      setStopTimes(stopTimes.map(st => st.id === stopTimeId ? res.data : st));
    } catch (e) {
      console.error("Failed to update stop time", e);
    }
  };

  const handleUpdateSchedule = async (data) => {
    try {
      const res = await api.patch(API_PATHS.transport.scheduleDetail(selectedSchedule.id), data);
      setSchedules(schedules.map(s => s.id === selectedSchedule.id ? res.data : s));
      setSelectedSchedule(res.data);
    } catch (e) {
      console.error("Failed to update schedule", e);
    }
  };

  return (
    <div className="flex h-full bg-slate-50 overflow-hidden font-sans">
      {/* Route & Schedule Selection Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-900 text-white">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <Clock className="text-indigo-400" size={24} /> Schedules
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
            Trip Time Management
          </p>
        </div>

        <div className="p-4 bg-slate-50 border-b border-slate-200">
           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">
            Select Route
          </label>
          <select 
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium"
            onChange={(e) => setSelectedRoute(routes.find(r => r.id === e.target.value))}
            value={selectedRoute?.id || ""}
          >
            <option value="">Choose a route...</option>
            {routes.map(route => (
              <option key={route.id} value={route.id}>{route.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Time Slots
            </h3>
            {selectedRoute && (
              <button 
                onClick={() => setShowAddSchedule(true)}
                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/20"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {!selectedRoute && (
            <div className="text-center py-12 text-slate-400">
              <RouteIcon size={48} className="mx-auto mb-4 opacity-10" />
              <p className="text-sm font-bold">Select a route to view its schedules</p>
            </div>
          )}

          {schedules.map(schedule => (
            <div 
              key={schedule.id}
              onClick={() => setSelectedSchedule(schedule)}
              className={`p-4 rounded-2xl border transition cursor-pointer group relative ${
                selectedSchedule?.id === schedule.id 
                ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20" 
                : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className={`text-xs font-black uppercase tracking-wider mb-1 ${
                    selectedSchedule?.id === schedule.id ? "text-indigo-200" : "text-slate-400"
                  }`}>
                    {schedule.label}
                  </div>
                  <div className="text-lg font-black flex items-center gap-2">
                    <Timer size={18} /> {schedule.scheduled_start_time.substring(0, 5)}
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSchedule(schedule.id);
                  }}
                  className={`p-2 rounded-xl transition opacity-0 group-hover:opacity-100 ${
                    selectedSchedule?.id === schedule.id 
                    ? "hover:bg-indigo-500 text-white" 
                    : "hover:bg-red-50 text-red-500"
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  schedule.is_active 
                  ? (selectedSchedule?.id === schedule.id ? "bg-indigo-500 text-white" : "bg-green-100 text-green-600")
                  : "bg-slate-100 text-slate-400"
                }`}>
                  {schedule.is_active ? "Active" : "Inactive"}
                </span>
                <span className={`text-[10px] font-bold ${
                   selectedSchedule?.id === schedule.id ? "text-indigo-200" : "text-slate-400"
                }`}>
                  {selectedRoute?.stops_count} stops
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area - Stop Times */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {selectedSchedule ? (
          <>
            <div className="p-8 bg-white border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                    {selectedSchedule.label} 
                    <ArrowRight className="text-slate-300" />
                    <span className="text-indigo-600">{selectedSchedule.scheduled_start_time.substring(0, 5)}</span>
                  </h1>
                  <p className="text-slate-500 font-bold mt-1">
                    Route: {selectedRoute?.name}
                  </p>
                </div>
                <div className="flex gap-3">
                   <button 
                    onClick={() => handleUpdateSchedule({ is_active: !selectedSchedule.is_active })}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg ${
                      selectedSchedule.is_active 
                      ? "bg-green-600 text-white shadow-green-600/20" 
                      : "bg-slate-200 text-slate-600 shadow-slate-200/20"
                    }`}
                  >
                    {selectedSchedule.is_active ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    {selectedSchedule.is_active ? "Live" : "Disabled"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Station Arrival Sequence
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    Auto-save enabled
                  </span>
                </div>

                <div className="relative">
                  {/* Vertical Line */}
                  <div className="absolute left-8 top-8 bottom-8 w-1 bg-slate-100 rounded-full z-0"></div>

                  <div className="space-y-6">
                    {stopTimes.map((st, idx) => (
                      <div key={st.id} className="relative z-10 flex items-center gap-8 group">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-xl shadow-xl transition border-4 ${
                          idx === 0 ? "bg-green-600 text-white border-green-100 scale-110" : 
                          idx === stopTimes.length - 1 ? "bg-red-600 text-white border-red-100" :
                          "bg-white text-indigo-600 border-indigo-50 shadow-indigo-600/5"
                        }`}>
                          {st.stop_sequence + 1}
                        </div>

                        <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm group-hover:shadow-xl group-hover:border-indigo-100 transition-all flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-black text-slate-900">{st.stop_name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Stop ID: {st.stop.substring(0, 8)}...
                            </p>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter mb-1">Arrival Time</span>
                              <input 
                                type="time"
                                step="60"
                                value={st.arrival_time.substring(0, 5)}
                                onChange={(e) => handleUpdateStopTime(st.id, { arrival_time: e.target.value })}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition"
                              />
                            </div>
                            <ChevronRight className="text-slate-200" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-12 text-center">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 text-indigo-600">
              <Calendar size={48} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">No Schedule Selected</h2>
            <p className="text-slate-500 font-bold max-w-sm mt-2">
              Select a route from the left sidebar and pick a time slot to manage stop-by-stop arrival times.
            </p>
          </div>
        )}

        {/* Add Schedule Modal Overlay */}
        {showAddSchedule && (
          <div className="absolute inset-0 z-[2000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="p-8 bg-slate-900 text-white">
                <h3 className="text-2xl font-black tracking-tighter">Add New Time Slot</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">For {selectedRoute?.name}</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Schedule Label</label>
                  <input 
                    placeholder="e.g. Morning Shift A"
                    value={newSchedule.label}
                    onChange={(e) => setNewSchedule({...newSchedule, label: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-black"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</label>
                  <input 
                    type="time"
                    value={newSchedule.scheduled_start_time}
                    onChange={(e) => setNewSchedule({...newSchedule, scheduled_start_time: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-black text-xl"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowAddSchedule(false)}
                    className="flex-1 py-4 rounded-2xl font-black text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddSchedule}
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition"
                  >
                    Create Slot
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripScheduleManager;
