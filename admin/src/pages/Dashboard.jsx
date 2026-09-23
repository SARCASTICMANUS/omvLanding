import { useState, useEffect } from "react";
import {
  Building2,
  Route,
  StopCircle,
  CalendarClock,
  Users,
  UserCheck,
} from "lucide-react";
import api from "../api/client";
import Loader from "../components/Loader";

// ─── Tiny decorative visuals (blue palette, purely geometric) ────────────
// City skyline glyph
const CitiesVisual = () => (
  <svg width="46" height="40" viewBox="0 0 46 40" fill="none" aria-hidden>
    <rect x="2" y="20" width="8" height="18" rx="2.5" fill="#60A5FA" opacity="0.55" />
    <rect x="14" y="10" width="9" height="28" rx="2.5" fill="#3B82F6" />
    <rect x="27" y="16" width="8" height="22" rx="2.5" fill="#93C5FD" opacity="0.75" />
    <rect x="38" y="6" width="7" height="32" rx="2.5" fill="#2563EB" opacity="0.9" />
  </svg>
);

// Route line glyph
const RoutesVisual = () => (
  <svg width="50" height="40" viewBox="0 0 50 40" fill="none" aria-hidden>
    <path d="M4 33 C 13 31, 15 22, 24 20 S 38 11, 45 6" stroke="#93C5FD" strokeWidth="6" strokeLinecap="round" opacity="0.22" />
    <path d="M4 33 C 13 31, 15 22, 24 20 S 38 11, 45 6" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="4" cy="33" r="2.5" fill="#2563EB" />
    <circle cx="45" cy="6" r="2.5" fill="#2563EB" />
  </svg>
);

// Ring indicator glyph
const StopsVisual = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
    <circle cx="22" cy="22" r="16" stroke="#E2E8F0" strokeWidth="5" />
    <circle cx="22" cy="22" r="16" stroke="#3B82F6" strokeWidth="5" strokeLinecap="round" strokeDasharray="58 100" transform="rotate(-90 22 22)" />
    <circle cx="22" cy="22" r="3.5" fill="#93C5FD" opacity="0.9" />
  </svg>
);

// Tiny clock glyph
const SchedulesVisual = () => (
  <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden>
    <circle cx="22" cy="22" r="18" stroke="#93C5FD" strokeWidth="2.5" opacity="0.8" />
    <path d="M22 13 v9 l7 5" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Grouped people bars glyph
const PassengersVisual = () => (
  <svg width="46" height="40" viewBox="0 0 46 40" fill="none" aria-hidden>
    <rect x="3" y="18" width="10" height="19" rx="5" fill="#60A5FA" opacity="0.5" />
    <rect x="18" y="9" width="10" height="28" rx="5" fill="#3B82F6" />
    <rect x="33" y="15" width="10" height="22" rx="5" fill="#93C5FD" opacity="0.75" />
  </svg>
);

// Activity bars glyph
const DriversVisual = () => (
  <svg width="50" height="40" viewBox="0 0 50 40" fill="none" aria-hidden>
    <rect x="2" y="27" width="7" height="10" rx="3.5" fill="#93C5FD" opacity="0.65" />
    <rect x="12" y="20" width="7" height="17" rx="3.5" fill="#60A5FA" opacity="0.75" />
    <rect x="22" y="11" width="7" height="26" rx="3.5" fill="#3B82F6" />
    <rect x="32" y="18" width="7" height="19" rx="3.5" fill="#60A5FA" opacity="0.75" />
    <rect x="42" y="25" width="7" height="12" rx="3.5" fill="#93C5FD" opacity="0.65" />
  </svg>
);

const statCards = [
  { key: "cities", label: "Cities", icon: Building2, visual: <CitiesVisual /> },
  { key: "routes", label: "Routes", icon: Route, visual: <RoutesVisual /> },
  { key: "stops", label: "Stops", icon: StopCircle, visual: <StopsVisual /> },
  { key: "schedules", label: "Schedules", icon: CalendarClock, visual: <SchedulesVisual /> },
  { key: "passengers", label: "Passengers", icon: Users, visual: <PassengersVisual /> },
  { key: "drivers", label: "Drivers", icon: UserCheck, visual: <DriversVisual /> },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/kpi/admin-stats/")
      .then((r) => setStats(r.data?.data || r.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="pt-4 pb-6 px-6 md:pt-5 md:pb-8 md:px-8 h-full overflow-y-auto">
      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
          <div
            key={card.key}
            className="glass-card p-5 relative overflow-hidden flex flex-col animate-glass-fade-in"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {/* Subtle ambient color wash */}
            <div
              className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full"
              style={{ background: "radial-gradient(closest-side, rgba(59,130,246,0.12), transparent)" }}
            />

            {/* Label row — icon kept subtle, next to the uppercase label */}
            <div className="relative z-10 flex items-center gap-1.5 mb-4">
              <Icon size={13} strokeWidth={2} className="text-slate-400" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{card.label}</span>
            </div>

            {/* Value + small visualization */}
            <div className="relative z-10 flex items-center justify-between gap-4">
              <span className="text-[30px] font-bold leading-none" style={{ color: "#16233F" }}>
                {stats?.[card.key]?.toLocaleString() ?? "0"}
              </span>
              <div className="opacity-90 shrink-0">{card.visual}</div>
            </div>

            {/* Quiet supporting area — no invented context */}
            <div className="relative z-10 flex-1" />
          </div>
          );
        })}
      </div>
    </div>
  );
}