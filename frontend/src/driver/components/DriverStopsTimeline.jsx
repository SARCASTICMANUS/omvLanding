import React from "react";
import { CheckCircle2, Clock3, Flag, MapPin, Users } from "lucide-react";
import { estimateStopTimeline } from "./driverFlowUtils";

const statusStyles = {
  completed: "border-emerald-500/30 bg-emerald-500 text-slate-950",
  current: "border-[#00E676]/30 bg-[#00E676] text-slate-950",
  origin: "border-cyan-500/30 bg-cyan-500 text-slate-950",
  destination: "border-rose-500/30 bg-rose-500 text-white",
  upcoming: "border-slate-700 bg-slate-800 text-slate-200",
};

export default function DriverStopsTimeline({
  route,
  currentStopIndex = -1,
  className = "",
}) {
  const stops = estimateStopTimeline(route);

  if (!stops.length) {
    return (
      <div className={`rounded-[18px] border border-slate-800 bg-slate-900/80 p-6 text-sm text-slate-400 ${className}`}>
        No stop timeline is available for this route yet.
      </div>
    );
  }

  return (
    <div className={`rounded-[18px] border border-slate-800 bg-slate-900/80 ${className}`}>
      <div className="border-b border-slate-800 px-5 py-4">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
          Route Timeline
        </p>
        <h3 className="mt-2 text-lg font-black text-white">
          Stop sequence and operational timing
        </h3>
      </div>

      <div className="max-h-[520px] overflow-y-auto px-5 py-4">
        <div className="relative">
          <div className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-px bg-slate-800" />
          <div className="space-y-4">
            {stops.map((stop, index) => {
              const resolvedStatus =
                currentStopIndex > -1
                  ? index < currentStopIndex
                    ? "completed"
                    : index === currentStopIndex
                    ? "current"
                    : index === stops.length - 1
                    ? "destination"
                    : "upcoming"
                  : stop.status === "destination"
                  ? "destination"
                  : stop.status === "origin"
                  ? "origin"
                  : "upcoming";

              return (
                <div key={stop.id || `${stop.name}-${index}`} className="relative pl-12">
                  <div
                    className={`absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-black ${statusStyles[resolvedStatus]}`}
                  >
                    {resolvedStatus === "completed" ? (
                      <CheckCircle2 size={15} />
                    ) : resolvedStatus === "destination" ? (
                      <Flag size={15} />
                    ) : (
                      <span>{stop.sequence}</span>
                    )}
                  </div>

                  <div className="rounded-[18px] border border-slate-800 bg-slate-950/90 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h4 className="text-base font-black text-white">{stop.name || `Stop ${stop.sequence}`}</h4>
                        <p className="mt-2 text-sm text-slate-400">
                          {stop.isBoardingPoint ? "Boarding point enabled" : "Operational transit stop"}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-2">
                            <Clock3 size={14} />
                            {stop.arrivalLabel}
                          </span>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-2">
                            {stop.isBoardingPoint ? <Users size={14} /> : <MapPin size={14} />}
                            {stop.isBoardingPoint ? "Boarding" : "Transit"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
