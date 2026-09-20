import { Route } from "lucide-react";

// Reuses real route data (same endpoints as the Routes page). Falls back to a
// local mock adapter when the API is unreachable.
export default function RouteSelector({ routes, value, onChange, disabled }) {
  return (
    <div className="memphis-card bg-memphis-paper p-5 md:p-6">
      <label className="memphis-label text-xs font-bold uppercase tracking-wider" htmlFor="zone-route-select">
        Select Route
      </label>
      <div className="relative mt-2">
        <Route size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-memphis-purple pointer-events-none" />
        <select
          id="zone-route-select"
          value={value || ""}
          onChange={(e) => onChange(routes.find((r) => String(r.id) === e.target.value) || null)}
          disabled={disabled || !routes.length}
          className="memphis-input w-full pl-11 pr-4 py-3.5 text-sm font-semibold outline-none transition disabled:opacity-60 cursor-pointer"
        >
          <option value="">[ Select Route ▼ ]</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {!routes.length && (
        <p className="text-xs text-memphis-ink/50 font-medium mt-2">
          No routes available yet.
        </p>
      )}
    </div>
  );
}
