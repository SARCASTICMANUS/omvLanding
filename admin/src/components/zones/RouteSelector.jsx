import { Route } from "lucide-react";

// Reuses real route data (same endpoints as the Routes page). Falls back to a
// local mock adapter when the API is unreachable.
export default function RouteSelector({ routes, value, onChange, disabled }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 md:p-6">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider" htmlFor="zone-route-select">
        Select Route
      </label>
      <div className="relative mt-2">
        <Route size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-600 pointer-events-none" />
        <select
          id="zone-route-select"
          value={value || ""}
          onChange={(e) => onChange(routes.find((r) => String(r.id) === e.target.value) || null)}
          disabled={disabled || !routes.length}
          className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-brand-600/20 transition disabled:opacity-60 cursor-pointer"
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
        <p className="text-xs text-slate-400 font-medium mt-2">
          No routes available yet.
        </p>
      )}
    </div>
  );
}
