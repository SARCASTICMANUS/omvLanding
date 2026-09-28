import React, { useMemo } from "react";
import { Users, MapPin, CheckCircle2, Clock, AlertCircle } from "lucide-react";

/**
 * DriverManifest Component
 * Displays a digital manifest for drivers, derived from the active trip's
 * stops (the backend has no dedicated manifest channel).
 */
const DriverManifest = ({ nextStops = [], allStops = [], live = false }) => {
  const firstOrder = nextStops[0]?.order ?? null;

  const stops = useMemo(
    () =>
      (nextStops || []).map((stop, idx) => ({
        stop_id: stop.stop_id ?? stop.id ?? idx,
        stop_name: stop.stop_name || stop.name || `Stop ${stop.order ?? idx + 1}`,
        order: stop.order ?? idx + 1,
        visited:
          stop.visited ?? (firstOrder != null && (stop.order ?? idx + 1) < firstOrder),
        passenger_count: stop.passenger_count ?? 0,
      })),
    [nextStops, firstOrder],
  );

  const totalStops = allStops?.length ?? 0;
  const remaining = stops.length;
  const waiting = stops.reduce(
    (sum, s) => sum + (s.passenger_count > 0 && !s.visited ? s.passenger_count : 0),
    0,
  );
  const progress =
    totalStops > 0 ? Math.min(1, Math.max(0, (totalStops - remaining) / totalStops)) : 0;

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 font-sans border-l border-slate-800 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
            <Users className="text-emerald-500" size={24} />
            Ride Pickup List
          </h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Live passenger pickup status
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black uppercase border ${
              live
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                : "bg-slate-500/10 border-slate-500/50 text-slate-400"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`}
            ></div>
            {live ? "Live" : "Idle"}
          </div>
          {waiting > 0 && (
            <div className="mt-2 text-xs font-bold text-slate-400 flex items-center gap-1">
              <AlertCircle size={12} className="text-amber-500" /> {waiting} waiting
            </div>
          )}
        </div>
      </div>

      {/* Timeline Section */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        {stops.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-600">
            <Clock size={40} className="mb-3 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-wider opacity-40">No pending pickups</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800"></div>

            <div className="space-y-10">
              {stops.map((stop) => (
                <div key={`${stop.stop_id}_${stop.order}`} className="relative pl-10 group">
                  {/* Indicator Dot */}
                  <div
                    className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-slate-950 z-10 transition-all duration-500 ${
                      stop.visited
                        ? "bg-slate-700"
                        : stop.passenger_count > 0
                          ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                          : "bg-blue-600"
                    }`}
                  ></div>

                  <div
                    className={`p-4 rounded-2xl border transition-all duration-300 ${
                      stop.passenger_count > 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3
                          className={`font-black text-lg leading-tight ${
                            stop.passenger_count > 0 ? "text-emerald-400" : "text-slate-200"
                          }`}
                        >
                          {stop.stop_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                            STOP #{stop.order}
                          </span>
                          {stop.visited && (
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-0.5 uppercase tracking-tighter">
                              <CheckCircle2 size={10} /> Visited
                            </span>
                          )}
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
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold"
                            >
                              P
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500/60 uppercase self-center ml-1">
                          Passengers at Stop
                        </span>
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
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              ></div>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase">Trip Progress</span>
        </div>
      </div>
    </div>
  );
};

export default DriverManifest;
