import { Hash, Route, StopCircle, Clock, Gauge } from "lucide-react";
import { formatKm } from "../../utils/zoneLogic";

// Read-only route facts. Route, stops, distance and ETA are never editable here.
export default function RouteSummary({ route, stops, distances, minutes }) {
  if (!route) return null;

  const totalMeters = route.total_distance_meters ?? distances[distances.length - 1] ?? 0;
  const totalMinutes = minutes[minutes.length - 1] ?? 0;

  const items = [
    { icon: Route, label: "Route Name", value: route.name },
    { icon: Hash, label: "Route ID", value: route.route_code || String(route.id).slice(0, 8) },
    { icon: StopCircle, label: "Total Stops", value: String(stops.length) },
    { icon: Gauge, label: "Total Distance", value: formatKm(totalMeters) },
    { icon: Clock, label: "Est. Duration", value: `${totalMinutes} min` },
  ];

  return (
    <div className="glass-card bg-white/80 p-5 md:p-6">
      <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Route Summary</h3>
      <p className="text-xs text-slate-500 font-medium mt-1">
        {route.start_name} → {route.end_name} · read-only
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="glass-card p-3 relative overflow-hidden flex flex-col">
            {/* Very subtle ambient blue/lavender wash */}
            <div
              className="pointer-events-none absolute -top-8 -right-8 h-16 w-16 rounded-full"
              style={{ background: "radial-gradient(closest-side, rgba(59,130,246,0.10), transparent)" }}
            />
            {/* Label + small secondary visual */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider truncate">{label}</p>
              <span className="shrink-0" style={{ color: "#3B82F6" }}>
                <Icon size={13} strokeWidth={2} />
              </span>
            </div>
            {/* Value — primary focus */}
            <p className="relative z-10 mt-1.5 text-sm font-semibold text-slate-800 truncate" title={value}>
              {value}
            </p>
            {/* Quiet supporting area keeps equal heights */}
            <div className="relative z-10 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
