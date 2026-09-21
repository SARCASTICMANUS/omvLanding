import { useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`bg-memphis-ink text-white flex flex-col shrink-0 relative overflow-hidden memphis-squiggle-bg transition-all duration-200 ease-in-out ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Header */}
      <div className={`relative z-10 border-b border-white/10 ${collapsed ? "px-3 py-5" : "px-6 py-5"}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-memphis-pink border-2 border-white/20 rounded-lg flex items-center justify-center font-black text-lg text-memphis-ink shrink-0">
            V
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-black text-lg tracking-tight truncate" style={{ fontFamily: "Archivo Black, sans-serif" }}>OMV Admin</h1>
              <p className="text-xs text-white/50 font-medium">Control Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="relative z-10 flex items-center justify-center h-8 text-white/40 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Nav */}
      <nav className="relative z-10 flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={collapsed ? tab.label : undefined}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                collapsed ? "justify-center px-2 py-3" : "px-4 py-3"
              } ${
                activeTab === tab.id
                  ? "bg-memphis-pink text-memphis-ink shadow-memphis-sm"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {Icon && <Icon size={18} className="shrink-0" />}
              {!collapsed && <span className="truncate">{tab.label}</span>}
              {!collapsed && activeTab === tab.id && (
                <span className="ml-auto w-2 h-2 bg-memphis-ink rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="relative z-10 p-2 border-t border-white/5">
        <button
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 rounded-lg text-sm font-semibold text-memphis-coral/70 hover:text-memphis-coral hover:bg-memphis-coral/10 transition-all duration-200 ${
            collapsed ? "justify-center px-2 py-3" : "px-4 py-3"
          }`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
