import {
  LayoutDashboard,
  MapPin,
  Route,
  Compass,
  StopCircle,
  CalendarClock,
  Users,
  Layers,
  ShieldCheck,
  BarChart3,
  LogOut,
} from "lucide-react";
import MemphisShapes from "./MemphisShapes";

const iconMap = {
  dashboard: LayoutDashboard,
  kpi: BarChart3,
  cities: MapPin,
  "route-explorer": Compass,
  routes: Route,
  stops: StopCircle,
  schedules: CalendarClock,
  drivers: ShieldCheck,
  users: Users,
  zones: Layers,
};

export default function Sidebar({ tabs, activeTab, onTabChange, onLogout }) {
  return (
    <aside className="w-64 bg-memphis-ink text-white flex flex-col shrink-0 relative overflow-hidden memphis-squiggle-bg">
      <MemphisShapes variant="sidebar" />

      <div className="relative z-10 p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-memphis-pink border-2 border-white/20 rounded-lg flex items-center justify-center font-black text-lg text-memphis-ink">
            V
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight" style={{ fontFamily: "Archivo Black, sans-serif" }}>OMV Admin</h1>
            <p className="text-xs text-white/50 font-medium">Control Panel</p>
          </div>
        </div>
      </div>

      <nav className="relative z-10 flex-1 p-4 space-y-1">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-memphis-pink text-memphis-ink shadow-memphis-sm"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {Icon && <Icon size={18} />}
              {tab.label}
              {activeTab === tab.id && (
                <span className="ml-auto w-2 h-2 bg-memphis-ink rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="relative z-10 p-4 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-memphis-coral/70 hover:text-memphis-coral hover:bg-memphis-coral/10 transition-all duration-200"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
