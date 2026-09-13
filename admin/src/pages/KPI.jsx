import { useState, useEffect } from "react";
import {
  BarChart3, Users, MapPin, Route, Bus, Activity, Globe, Smartphone, Monitor,
  TrendingUp, ArrowUpRight, MousePointerClick, Repeat, Car, UserPlus, CalendarCheck, MapPinned,
} from "lucide-react";
import api from "../api/client";

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value?.toLocaleString() ?? "—"}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-slate-500 font-medium">{sub}</p>}
    </div>
  );
}

function BarChart({ data, labelKey, valueKey, color = "bg-brand-500", maxItems = 7 }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No data</div>;
  }
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map((d) => d[valueKey] || 0), 1);

  return (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 w-28 truncate text-right">{d[labelKey]}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all duration-500`}
              style={{ width: `${((d[valueKey] || 0) / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-700 w-12 text-right">{(d[valueKey] || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, labelKey, valueKey, colors }) {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm">No data</div>;
  }
  const total = data.reduce((s, d) => s + (d[valueKey] || 0), 0);
  let cum = 0;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
        {data.map((d, i) => {
          const pct = total > 0 ? ((d[valueKey] || 0) / total) * 100 : 0;
          const offset = cum;
          cum += pct;
          return (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={`${-offset}`}
            />
          );
        })}
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
            <span className="text-xs font-semibold text-slate-600">{d[labelKey]}</span>
            <span className="text-xs font-bold text-slate-800 ml-auto">{(d[valueKey] || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Web KPIs ──────────────────────────────────────────
function WebMetrics({ data, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const s = data?.summary || {};

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<ArrowUpRight size={20} />} label="Total Visits" value={s.total_visits} color="bg-blue-500" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Users size={20} />} label="Unique Visitors" value={s.unique_visitors} color="bg-emerald-500" sub={`${s.avg_views_per_visitor || 0} avg views/visitor`} />
        <StatCard icon={<MousePointerClick size={20} />} label="Bounce Rate" value={`${s.bounce_rate || 0}%`} color="bg-amber-500" sub="Single-page sessions" />
        <StatCard icon={<Repeat size={20} />} label="Avg Views / Visitor" value={s.avg_views_per_visitor} color="bg-purple-500" sub="Pages per session" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-500" /> Daily Visits
          </h3>
          <BarChart
            data={data?.daily?.map((d) => ({ label: d.day, views: d.views }))}
            labelKey="label"
            valueKey="views"
            color="bg-brand-500"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Globe size={16} className="text-blue-500" /> Top Pages
          </h3>
          <BarChart
            data={data?.top_pages?.map((p) => ({ label: p.page || "/", views: p.views }))}
            labelKey="label"
            valueKey="views"
            color="bg-blue-500"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Monitor size={16} className="text-purple-500" /> Device Breakdown
          </h3>
          <DonutChart
            data={data?.device_stats?.map((d) => ({ label: d.device_type || "Unknown", views: d.views }))}
            labelKey="label"
            valueKey="views"
            colors={["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"]}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <ArrowUpRight size={16} className="text-amber-500" /> Top Referrers
          </h3>
          <BarChart
            data={data?.referrer_stats?.map((r) => {
              let label = r.referrer;
              try { label = new URL(r.referrer).hostname; } catch {}
              return { label, views: r.views };
            })}
            labelKey="label"
            valueKey="views"
            color="bg-amber-500"
          />
        </div>
      </div>
    </>
  );
}

// ─── App KPIs ──────────────────────────────────────────
function AppMetrics({ data, loading }) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const s = data?.summary || {};
  const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={20} />} label="Total Users" value={s.total_users} color="bg-blue-500" sub={`${s.total_passengers} passengers, ${(s.total_bike_drivers || 0) + (s.total_auto_drivers || 0)} drivers`} />
        <StatCard icon={<UserPlus size={20} />} label="New Users" value={s.new_users_period} color="bg-emerald-500" sub={`Last ${data?.period_days || 30} days`} />
        <StatCard icon={<Bus size={20} />} label="Completed Trips" value={s.total_trips} color="bg-purple-500" sub={`${s.trips_period} in period`} />
        <StatCard icon={<MapPinned size={20} />} label="Active Trips" value={s.active_trips} color="bg-amber-500" sub="Happening now" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Route size={20} />} label="Routes" value={s.total_routes} color="bg-indigo-500" sub={`${s.total_stops} stops`} />
        <StatCard icon={<MapPin size={20} />} label="Cities" value={s.total_cities} color="bg-pink-500" sub={`${s.total_schedules} schedules`} />
        <StatCard icon={<Car size={20} />} label="Vehicles" value={s.total_vehicles} color="bg-teal-500" sub={`${s.active_vehicles} active`} />
        <StatCard icon={<CalendarCheck size={20} />} label="Boardings" value={s.total_boardings} color="bg-orange-500" sub={`${s.boardings_period} in period`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-brand-500" /> Daily Trips
          </h3>
          <BarChart
            data={data?.daily_trips?.map((d) => ({ label: d.day, trips: d.trips }))}
            labelKey="label"
            valueKey="trips"
            color="bg-brand-500"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-emerald-500" /> Daily New Users
          </h3>
          <BarChart
            data={data?.daily_users?.map((d) => ({ label: d.day, users: d.users }))}
            labelKey="label"
            valueKey="users"
            color="bg-emerald-500"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Bus size={16} className="text-purple-500" /> Trip Status
          </h3>
          <DonutChart
            data={data?.trip_status?.map((d) => ({ label: d.status, count: d.count }))}
            labelKey="label"
            valueKey="count"
            colors={COLORS}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Route size={16} className="text-indigo-500" /> Routes by City
          </h3>
          <BarChart
            data={data?.city_routes?.map((d) => ({ label: d.name, routes: d.route_count }))}
            labelKey="label"
            valueKey="routes"
            color="bg-indigo-500"
          />
        </div>
      </div>
    </>
  );
}

// ─── Main ──────────────────────────────────────────────
export default function KPI() {
  const [platform, setPlatform] = useState("web");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    api.get(`/kpi/overview/?platform=${platform}&days=${days}`)
      .then((r) => setData(r.data?.data || r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [platform, days]);

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <BarChart3 className="text-brand-500" size={32} />
            KPI & Analytics
          </h1>
          <p className="text-slate-500 mt-1 font-medium">
            {platform === "web" ? "Landing page visitor metrics" : "Transit app performance metrics"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Platform toggle */}
      <div className="flex items-center gap-2 mb-8">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { id: "web", label: "Website", icon: <Globe size={14} />, desc: "Landing page & waitlist" },
            { id: "app", label: "Mobile App", icon: <Smartphone size={14} />, desc: "Transit product" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                platform === p.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      {platform === "web" ? (
        <WebMetrics data={data} loading={loading} />
      ) : (
        <AppMetrics data={data} loading={loading} />
      )}
    </div>
  );
}
