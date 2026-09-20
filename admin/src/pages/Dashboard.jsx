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
import { Zigzag } from "../components/MemphisShapes";
import Loader from "../components/Loader";

const statCards = [
  { key: "cities", label: "Cities", icon: Building2, color: "bg-memphis-teal", border: "border-memphis-teal" },
  { key: "routes", label: "Routes", icon: Route, color: "bg-memphis-pink", border: "border-memphis-pink" },
  { key: "stops", label: "Stops", icon: StopCircle, color: "bg-memphis-purple", border: "border-memphis-purple" },
  { key: "schedules", label: "Schedules", icon: CalendarClock, color: "bg-memphis-yellow", border: "border-memphis-yellow" },
  { key: "passengers", label: "Passengers", icon: Users, color: "bg-memphis-mint", border: "border-memphis-mint" },
  { key: "drivers", label: "Drivers", icon: UserCheck, color: "bg-memphis-coral", border: "border-memphis-coral" },
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
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="memphis-title">Dashboard</h1>
        <Zigzag className="mt-2 opacity-40" />
        <p className="text-memphis-purple mt-2 font-medium">Platform overview at a glance</p>
      </div>

      {/* Memphis Timeline divider between header and cards */}
      <div className="memphis-divider" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="memphis-card p-6 relative overflow-hidden">
            {/* Terrazzo background at 5% opacity for stat cards */}
            <div className="absolute inset-0 memphis-terrazzo-bg pointer-events-none" />
            <div className="relative flex items-center justify-between mb-4">
              <div className={`memphis-icon-tile ${color}`}>
                <Icon size={20} className="text-memphis-ink" />
              </div>
              <span className="text-3xl font-black text-memphis-ink" style={{ fontFamily: "Archivo Black, sans-serif" }}>
                {stats?.[key] ?? 0}
              </span>
            </div>
            <p className="memphis-label">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
