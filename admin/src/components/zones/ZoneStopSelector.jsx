import { ChevronDown, MapPin } from "lucide-react";
import { stopIndexById, zoneEndRange, shortStopName } from "../../utils/zoneLogic";

// Stop-boundary picker for a zone. Starts are always auto-derived from the
// previous zone's end (never free-form), so gaps/overlaps are impossible.
export default function ZoneStopSelector({ stops, zones, zoneIndex, zone, onZoneChange }) {
  const startIdx = stopIndexById(stops, zone.startStopId);
  const endIdx = stopIndexById(stops, zone.endStopId);
  const { maxIdx } = zoneEndRange(stops, zones, zoneIndex);
  const isLast = zoneIndex === zones.length - 1;

  const startStop = stops[Math.max(0, startIdx)];
  const endStop = stops[Math.min(stops.length - 1, endIdx)];

  const endOptions = [];
  for (let i = Math.max(0, startIdx); i <= maxIdx; i++) {
    endOptions.push({ idx: i, stop: stops[i] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          Start
        </span>
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-100/50 border border-slate-200 rounded-xl">
          <MapPin size={14} className="text-slate-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-800 truncate">
            {shortStopName(startStop) || "—"}
          </span>
          {startIdx === 0 && (
            <span className="ml-auto shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-teal-600 uppercase">
              Route start
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
          End
        </span>
        {isLast ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-slate-100/50 border border-slate-200 rounded-xl">
            <MapPin size={14} className="text-slate-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate">
              {shortStopName(endStop) || "—"}
            </span>
            <span className="ml-auto shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-500 uppercase">
              Route end
            </span>
          </div>
        ) : (
          <div className="relative flex-1">
            <select
              value={endStop?.id ?? ""}
              onChange={(e) => onZoneChange(zoneIndex, { endStopId: e.target.value })}
              className="glass-input w-full appearance-none px-3 py-2.5 text-sm font-semibold outline-none cursor-pointer"
            >
              {endOptions.map(({ idx, stop }) => (
                <option key={stop.id} value={stop.id}>
                  Stop {idx + 1} — {shortStopName(stop)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
