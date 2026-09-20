import { stopIndexById, formatKm, shortStopName } from "../../utils/zoneLogic";

const ZONE_BAND_COLORS = [
  "bg-memphis-pink/30 border-memphis-pink text-memphis-ink",
  "bg-memphis-teal/30 border-memphis-teal text-memphis-ink",
  "bg-memphis-yellow/30 border-memphis-yellow text-memphis-ink",
  "bg-memphis-purple/30 border-memphis-purple text-memphis-ink",
];

// Horizontal route timeline. Each zone wraps its assigned stops. Purely
// derived from the current zone boundaries — nothing manual about position.
export default function RouteTimeline({ stops, zones, distances, minutes }) {
  if (!stops?.length || !zones?.length) return null;

  const totalStops = stops.length;

  return (
    <div className="memphis-card bg-memphis-paper p-5 md:p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-memphis-ink uppercase tracking-wider">Route Timeline</h3>
        <span className="text-[11px] text-memphis-ink/40 font-medium">{totalStops} stops</span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          {/* Zone bands */}
          <div className="relative h-14">
            {zones.map((zone, zi) => {
              const startIdx = stopIndexById(stops, zone.startStopId);
              const endIdx = stopIndexById(stops, zone.endStopId);
              if (startIdx < 0 || endIdx < 0) return null;
              const left = (startIdx / totalStops) * 100;
              const width = ((endIdx - startIdx + 1) / totalStops) * 100;
              return (
                <div
                  key={zone.id}
                  className="absolute top-0 px-1"
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <div className={`h-full rounded-xl border-2 flex flex-col items-center justify-center ${ZONE_BAND_COLORS[zi % ZONE_BAND_COLORS.length]}`}>
                    <span className="text-[10px] font-black uppercase tracking-wider leading-tight truncate w-full text-center">
                      {zone.name} · ₹{zone.flatFareINR}
                    </span>
                    <span className="text-[9px] font-medium opacity-80 leading-tight">
                      {startIdx + 1}–{endIdx + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rail */}
          <div className="relative my-4 h-0.5 bg-memphis-ink/20">
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-memphis-pink border-2 border-memphis-paper shadow"
              style={{ left: `${(0.5 / totalStops) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-memphis-pink border-2 border-memphis-paper shadow"
              style={{ left: `${((totalStops - 0.5) / totalStops) * 100}%` }}
            />
          </div>

          {/* Stops */}
          <div className="flex">
            {stops.map((stop, si) => {
              const activeZone = zones.find((z) => {
                const s = stopIndexById(stops, z.startStopId);
                const e = stopIndexById(stops, z.endStopId);
                return si >= s && si <= e;
              });
              const isZoneStart = zones.some((z) => stopIndexById(stops, z.startStopId) === si);
              return (
                <div key={stop.id} className="flex-1 flex flex-col items-center gap-1.5 px-1">
                  <div
                    className={`h-3 w-3 rounded-full border-2 border-memphis-paper shadow ${
                      isZoneStart ? "bg-memphis-pink" : "bg-memphis-ink/30"
                    }`}
                  />
                  <span className="text-[10px] font-bold text-memphis-ink/40">S{si + 1}</span>
                  <span className="text-[11px] font-semibold text-memphis-ink text-center leading-tight truncate w-full">
                    {shortStopName(stop)}
                  </span>
                  <span className="text-[10px] text-memphis-ink/40 font-medium">
                    {formatKm(distances[si])}
                  </span>
                  <span className="text-[10px] text-memphis-ink/40 font-medium -mt-1">
                    {minutes[si]} min
                  </span>
                  {activeZone && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-memphis-purple">
                      {activeZone.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
