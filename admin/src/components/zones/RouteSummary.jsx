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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Route Summary</h3>
      <p className="text-xs text-slate-400 font-medium mt-1">
        {route.start_name} → {route.end_name} · read-only
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <div className="flex items-center gap-1.5">
              <Icon size={13} className="text-brand-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
            </div>
            <p className="mt-1.5 text-sm font-black text-slate-800 truncate" title={value}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
