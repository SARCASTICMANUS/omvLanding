import { Route, ChevronDown } from "lucide-react";

// Reuses real route data (same endpoints as the Routes page). Falls back to a
// local mock adapter when the API is unreachable.
export default function RouteSelector({ routes, value, onChange, disabled }) {
  return (
    <div className="glass-card bg-white/80 p-5 md:p-6">
      <label className="glass-label text-xs uppercase tracking-wider" htmlFor="zone-route-select">
        Select Route
      </label>
      <div className="relative mt-2">
        <Route size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <select
          id="zone-route-select"
          value={value || ""}
          onChange={(e) => onChange(routes.find((r) => String(r.id) === e.target.value) || null)}
          disabled={disabled || !routes.length}
          className="glass-input w-full pl-11 pr-10 py-3.5 text-sm font-semibold appearance-none outline-none transition disabled:opacity-60 cursor-pointer"
        >
          <option value="">Select Route</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
      {!routes.length && (
        <p className="text-xs text-slate-500 font-medium mt-2">
          No routes available yet.
        </p>
      )}
    </div>
  );
}
