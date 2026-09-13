import { useState, useEffect } from "react";
import {
  Building2,
  Route,
  StopCircle,
  CalendarClock,
  Users,
  Bike,
  UserCheck,
} from "lucide-react";
import api from "../api/client";

const statCards = [
  { key: "cities", label: "Cities", icon: Building2, color: "bg-blue-500" },
  { key: "routes", label: "Routes", icon: Route, color: "bg-emerald-500" },
  { key: "stops", label: "Stops", icon: StopCircle, color: "bg-purple-500" },
  { key: "schedules", label: "Schedules", icon: CalendarClock, color: "bg-amber-500" },
  { key: "passengers", label: "Passengers", icon: Users, color: "bg-indigo-500" },
  { key: "drivers", label: "Drivers", icon: UserCheck, color: "bg-rose-500" },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/transport/cities/").then((r) => r.data).catch(() => []),
      api.get("/transport/routes/").then((r) => r.data).catch(() => []),
      api.get("/transport/stops/").then((r) => r.data).catch(() => []),
      api.get("/transport/schedules/").then((r) => r.data).catch(() => []),
      api.get("/accounts/users/?role=passenger").then((r) => r.data).catch(() => []),
      api.get("/accounts/users/?role=bikedriver").then((r) => r.data).catch(() => ({ results: [] })),
      api.get("/accounts/users/?role=autodriver").then((r) => r.data).catch(() => []),
    ]).then(
      ([cities, routes, stops, schedules, passengers, bikedrivers, autodrivers]) => {
        const c = Array.isArray(cities) ? cities : cities.results || [];
        const r = Array.isArray(routes) ? routes : routes.results || [];
        const s = Array.isArray(stops) ? stops : stops.results || [];
        const sch = Array.isArray(schedules) ? schedules : schedules.results || [];
        const p = Array.isArray(passengers) ? passengers : passengers.results || [];
        const bd = Array.isArray(bikedrivers) ? bikedrivers : bikedrivers.results || [];
        const ad = Array.isArray(autodrivers) ? autodrivers : autodrivers.results || [];
        setStats({
          cities: c.length,
          routes: r.length,
          stops: s.length,
          schedules: sch.length,
          passengers: p.length,
          drivers: bd.length + ad.length,
        });
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1 font-medium">Platform overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div
            key={key}
            className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                <Icon size={22} className="text-white" />
              </div>
              <span className="text-3xl font-black text-slate-800">
                {stats?.[key] ?? 0}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
