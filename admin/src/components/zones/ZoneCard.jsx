import { Layers, MapPin } from "lucide-react";
import { stopIndexById, formatKm, shortStopName } from "../../utils/zoneLogic";
import ZoneStopSelector from "./ZoneStopSelector";
import ZoneFareInput from "./ZoneFareInput";

const ZONE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ZONE_HEADER_COLORS = [
  "bg-memphis-pink/20 text-memphis-ink",
  "bg-memphis-teal/20 text-memphis-ink",
  "bg-memphis-yellow/20 text-memphis-ink",
  "bg-memphis-purple/20 text-memphis-ink",
];

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
    <div className="memphis-card bg-memphis-paper overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 border-b-2 border-memphis-ink/10 ${ZONE_HEADER_COLORS[zoneIndex % ZONE_HEADER_COLORS.length]}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-memphis-ink/10 text-memphis-ink rounded-xl flex items-center justify-center">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-memphis-ink/50 uppercase tracking-wider">
              Zone {letter}
            </p>
            <input
              value={zone.name}
              onChange={(e) => onZoneChange(zoneIndex, { name: e.target.value })}
              placeholder="Zone name"
              className={`w-36 mt-0.5 px-2 py-1 -mx-2 bg-transparent border-b-2 text-sm font-bold text-memphis-ink outline-none transition focus:ring-0 ${
                nameInvalid
                  ? "border-memphis-coral focus:border-memphis-coral"
                  : "border-transparent focus:border-memphis-purple"
              }`}
            />
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-memphis-ink/10 text-memphis-ink">
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
          <div className="rounded-xl bg-memphis-mint/10 border border-memphis-mint/20 p-4">
            <p className="text-[10px] font-bold text-memphis-ink/40 uppercase tracking-wider mb-3">
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
                            ? "bg-memphis-pink border-memphis-pink/30"
                            : "bg-memphis-paper border-memphis-ink/20"
                        }`}
                      />
                      {!isLast && <div className="w-px h-4 bg-memphis-ink/15" />}
                    </div>
                    <div className={`min-w-0 ${isLast ? "" : "pb-1"}`}>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[11px] font-bold truncate ${isBoundary ? "text-memphis-ink" : "text-memphis-ink/60"}`}>
                          {shortStopName(stop)}
                        </span>
                        <span className="text-[10px] text-memphis-ink/40 shrink-0">
                          S{stopIdx + 1}
                        </span>
                      </div>
                      {i > 0 && (
                        <span className="text-[10px] text-memphis-ink/40">
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
          <div className="rounded-xl bg-memphis-yellow/10 border border-memphis-yellow/20 p-3">
            <p className="text-[10px] font-bold text-memphis-ink/40 uppercase tracking-wider">Distance</p>
            <p className="mt-1 text-sm font-bold text-memphis-ink">
              {formatKm(from)} → {formatKm(to)}
            </p>
            <p className="text-[10px] text-memphis-ink/40 font-medium">
              {startIdx >= 0 ? `Stop ${startIdx + 1}` : "—"} → {endIdx >= 0 ? `Stop ${endIdx + 1}` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-memphis-teal/10 border border-memphis-teal/20 p-3">
            <p className="text-[10px] font-bold text-memphis-ink/40 uppercase tracking-wider">Flat Fuel Share</p>
            <div className="mt-1">
              <ZoneFareInput value={zone.flatFareINR} onChange={(v) => onZoneChange(zoneIndex, { flatFareINR: v })} invalid={fareInvalid} />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-memphis-ink/40 font-medium leading-relaxed">
          Passengers pay the zone fuel share based on where their journey ends.
        </p>
      </div>
    </div>
  );
}
