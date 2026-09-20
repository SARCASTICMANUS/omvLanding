import { MapPin } from "lucide-react";
import { stopIndexById, shortStopName } from "../../utils/zoneLogic";

// Frontend-only demonstration of what passengers would pay for journeys that
// END in each zone. Fare is determined by the destination's zone.
export default function FareExamples({ stops, zones }) {
  const ordered = [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const first = ordered[0];

  const examples = (zones || [])
    .filter((z) => {
      const e = stopIndexById(ordered, z.endStopId);
      return e >= 0;
    })
    .map((z) => {
      const e = stopIndexById(ordered, z.endStopId);
      return {
        id: z.id,
        zoneName: z.name,
        toName: shortStopName(ordered[e]),
        toStopNo: e + 1,
        fare: Number(z.flatFareINR),
        valid: Number.isFinite(Number(z.flatFareINR)) && Number(z.flatFareINR) >= 0,
      };
    });

  if (!first || !examples.length) return null;

  return (
    <div className="memphis-card bg-memphis-paper p-5 md:p-6">
      <h3 className="text-sm font-bold text-memphis-ink uppercase tracking-wider">Fuel Share Examples</h3>
      <p className="text-xs text-memphis-ink/50 font-medium mt-1">
        Passengers pay the zone fuel share based on where their journey ends. Demo only — no pricing logic runs here.
      </p>

      <div className="mt-4 space-y-2">
        {examples.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-memphis-yellow/10 border border-memphis-yellow/20">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={14} className="text-memphis-purple shrink-0" />
              <span className="text-sm font-medium text-memphis-ink/70 truncate">
                Stop 1 → <span className="font-semibold text-memphis-ink">{ex.toName}</span>
              </span>
            </div>
            <span className="text-sm font-black text-memphis-ink">
              {ex.valid ? `₹${ex.fare}` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
