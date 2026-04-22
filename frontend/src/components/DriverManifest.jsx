import React, { useState, useEffect, useRef } from "react";
import { Users, MapPin, CheckCircle2, Clock, AlertCircle } from "lucide-react";
<<<<<<< HEAD
=======
import api, { getWsUrl } from "../lib/api";
>>>>>>> temp-save

/**
 * DriverManifest Component
 * Displays a real-time digital manifest for drivers.
 * Connects to ws://host/ws/driver/manifest/<vehicle_id>/
 */
const DriverManifest = ({ vehicleId, tripId }) => {
  const [manifest, setManifest] = useState(null);
  const [next3Stops, setNext3Stops] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);

  useEffect(() => {
    if (!vehicleId) return;

    const token = localStorage.getItem("token");
<<<<<<< HEAD
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host.split(":")[0];
    const wsUrl = `${protocol}://${host}:8000/ws/driver/manifest/${vehicleId}/?token=${token}`;
=======
    const wsUrl = getWsUrl(`/ws/driver/manifest/${vehicleId}/?token=${token}`);
>>>>>>> temp-save

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log("[Manifest WS] Connected");
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("[Manifest WS] Received data:", data);

      if (data.type === "manifest_update") {
        // The backend broadcasts 'redis_manifest' which contains the structure
        const manifest = data.redis_manifest || {};
        
        // Handle stops from the manifest object (stops_json is a string)
        let stops = [];
        if (manifest.stops) {
          stops = manifest.stops;
        } else if (manifest.stops_json) {
           try {
             stops = JSON.parse(manifest.stops_json);
           } catch(e) {
             console.error("Failed to parse stops_json", e);
           }
        }
        
        setNext3Stops(stops);
        setTotalPending(data.total_pending || 0);
        setManifest(manifest);
      }
    };

    ws.current.onclose = () => {
      console.log("[Manifest WS] Disconnected");
      setIsConnected(false);
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [vehicleId]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-sans border-l border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
            <Users className="text-emerald-500" size={24} /> 
            Digital Manifest
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Real-time Boarding Control
          </p>
        </div>
        <div className="flex flex-col items-end">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase border ${isConnected ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                {isConnected ? 'Live' : 'Offline'}
            </div>
            {totalPending > 0 && (
                <div className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1">
                    <AlertCircle size={12} className="text-amber-500" /> {totalPending} waiting
                </div>
            )}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {next3Stops.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600">
            <Clock size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-wider opacity-40">No pending pickups</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800"></div>

            <div className="space-y-10">
              {next3Stops.map((stop, idx) => (
                <div key={`${stop.stop_id}_${idx}`} className="relative pl-10 group">
                  {/* Indicator Dot */}
                  <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-slate-950 z-10 transition-all duration-500 ${stop.visited ? 'bg-slate-700' : (stop.passenger_count > 0 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-blue-600')}`}>
                  </div>

                  <div className={`p-4 rounded-2xl border transition-all duration-300 ${stop.passenger_count > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={`font-black text-lg leading-tight ${stop.passenger_count > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {stop.stop_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                           <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">STOP #{stop.order}</span>
                           {stop.visited && <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5 uppercase tracking-tighter"><CheckCircle2 size={10}/> Visited</span>}
                        </div>
                      </div>

                      {stop.passenger_count > 0 && !stop.visited && (
                        <div className="flex flex-col items-end">
                            <div className="bg-emerald-500 text-slate-950 w-10 h-10 rounded-xl flex flex-col items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <span className="text-xl font-black leading-none">{stop.passenger_count}</span>
                                <span className="text-[8px] font-bold uppercase leading-none mt-0.5">Wait</span>
                            </div>
                        </div>
                      )}
                    </div>
                    
                    {stop.passenger_count > 0 && !stop.visited && (
                        <div className="mt-4 pt-4 border-t border-emerald-500/20 flex gap-2">
                             <div className="flex -space-x-2">
                                {Array.from({ length: Math.min(stop.passenger_count, 3) }).map((_, i) => (
                                    <div key={i} className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold">
                                        P
                                    </div>
                                ))}
                             </div>
                             <span className="text-[10px] font-bold text-emerald-500/60 uppercase self-center ml-1">Passengers at Stop</span>
                        </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-800">
          <div className="flex items-center gap-3 text-slate-500">
              <MapPin size={16} />
              <div className="flex-1">
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 w-1/3"></div>
                  </div>
              </div>
              <span className="text-[10px] font-black uppercase">Trip Progress</span>
          </div>
      </div>
    </div>
  );
};

export default DriverManifest;
