import { Layers, MapPin } from "lucide-react";
import { stopIndexById, formatKm, shortStopName } from "../../utils/zoneLogic";
import ZoneStopSelector from "./ZoneStopSelector";
import ZoneFareInput from "./ZoneFareInput";

const ZONE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function ZoneCard({ stops, zones, zoneIndex, zone, distances, onZoneChange }) {
  const startIdx = stopIndexById(stops, zone.startStopId);
  const endIdx = stopIndexById(stops, zone.endStopId);
  const count = startIdx >= 0 && endIdx >= 0 ? endIdx - startIdx + 1 : 0;
  const fareInvalid = zone.flatFareINR === "" || !Number.isFinite(Number(zone.flatFareINR)) || Number(zone.flatFareINR) < 0;
  const nameInvalid = !zone.name || !zone.name.trim();
  const letter = ZONE_LETTERS[zoneIndex] || zoneIndex + 1;

  const from = distances[startIdx] ?? 0;
  const to = distances[endIdx] ?? distances[distances.length - 1] ?? 0;

  const includedStops = startIdx >= 0 && endIdx >= 0
    ? stops.slice(startIdx, endIdx + 1)
    : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Zone {letter}
            </p>
            <input
              value={zone.name}
              onChange={(e) => onZoneChange(zoneIndex, { name: e.target.value })}
              placeholder="Zone name"
              className={`w-36 mt-0.5 px-2 py-1 -mx-2 bg-transparent border-b-2 text-sm font-bold text-slate-800 outline-none transition focus:ring-0 ${
                nameInvalid
                  ? "border-red-300 focus:border-red-400"
                  : "border-transparent focus:border-brand-500"
              }`}
            />
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          {count} {count === 1 ? "Stop" : "Stops"} Included
        </span>
      </div>

      <div className="p-5 space-y-4">
        <ZoneStopSelector
          stops={stops}
          zones={zones}
          zoneIndex={zoneIndex}
          zone={zone}
          onZoneChange={onZoneChange}
        />

        {includedStops.length > 0 && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Included Stops ({includedStops.length})
            </p>
            <div className="space-y-0">
              {includedStops.map((stop, i) => {
                const isFirst = i === 0;
                const isLast = i === includedStops.length - 1;
                const isBoundary = isFirst || isLast;
                const stopIdx = stopIndexById(stops, stop.id);
                return (
                  <div key={stop.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0 pt-0.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full border-2 ${
                          isBoundary
                            ? "bg-brand-600 border-brand-300"
                            : "bg-white border-slate-300"
                        }`}
                      />
                      {!isLast && <div className="w-px h-4 bg-slate-200" />}
                    </div>
                    <div className={`min-w-0 ${isLast ? "" : "pb-1"}`}>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[11px] font-bold truncate ${isBoundary ? "text-brand-700" : "text-slate-500"}`}>
                          {shortStopName(stop)}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          S{stopIdx + 1}
                        </span>
                      </div>
                      {i > 0 && (
                        <span className="text-[10px] text-slate-400">
                          {formatKm(distances[stopIdx])}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distance</p>
            <p className="mt-1 text-sm font-bold text-slate-700">
              {formatKm(from)} → {formatKm(to)}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">
              {startIdx >= 0 ? `Stop ${startIdx + 1}` : "—"} → {endIdx >= 0 ? `Stop ${endIdx + 1}` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flat Fare</p>
            <div className="mt-1">
              <ZoneFareInput value={zone.flatFareINR} onChange={(v) => onZoneChange(zoneIndex, { flatFareINR: v })} invalid={fareInvalid} />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
          Passengers pay the zone fare based on where their journey ends.
        </p>
      </div>
    </div>
  );
}
