import ZoneCard from "./ZoneCard";

// Renders one editable card per zone. Zone boundaries are stop-based, so the
// cards are the single source of truth for how the route is divided.
export default function ZoneConfiguration({ stops, zones, distances, onZoneChange }) {
  if (!zones?.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-memphis-ink uppercase tracking-wider">
            Zone Configuration
          </h3>
          <p className="text-xs text-memphis-ink/50 font-medium mt-1">
            Each zone's end stop defines where the next zone begins.
          </p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-memphis-purple/20 text-memphis-ink">
          {zones.length} zones
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {zones.map((zone, zi) => (
          <ZoneCard
            key={zone.id}
            stops={stops}
            zones={zones}
            zoneIndex={zi}
            zone={zone}
            distances={distances}
            onZoneChange={onZoneChange}
          />
        ))}
      </div>
    </div>
  );
}
