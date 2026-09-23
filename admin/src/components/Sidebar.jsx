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
      className={`flex flex-col shrink-0 relative overflow-hidden transition-all duration-300 ease-in-out ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand" : "Collapse"}
        className="relative z-10 flex items-center justify-center h-10 text-slate-400 hover:text-slate-700 hover:bg-white/60 transition-all duration-200"
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Nav */}
      <nav className="relative z-10 flex-1 py-4 px-2.5 space-y-1 overflow-y-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={collapsed ? tab.label : undefined}
              className={`w-full flex items-center gap-3 rounded-xl text-sm transition-all duration-200 ${
                collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
              } ${
                isActive
                  ? "font-semibold text-[#16233F] bg-accent-primary/10"
                  : "font-medium text-slate-500 hover:text-slate-700 hover:bg-accent-primary/5"
              }`}
              style={isActive ? {
                boxShadow: "0 2px 10px rgba(46,92,255,0.08)",
              } : {}}
            >
              {Icon && <Icon size={19} className="shrink-0" style={isActive ? { color: "#2E5CFF" } : { color: "#94A3B8" }} />}
              {!collapsed && <span className="truncate">{tab.label}</span>}
              {!collapsed && isActive && (
                <span className="ml-auto w-2 h-2 rounded-full"
                  style={{ background: "linear-gradient(135deg, #2E5CFF, #7DD3FC)", boxShadow: "0 0 8px rgba(46,92,255,0.4)" }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="relative z-10 p-2.5">
        <button
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          className={`w-full flex items-center gap-3 rounded-xl text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all duration-200 ${
            collapsed ? "justify-center px-2 py-3" : "px-3.5 py-2.5"
          }`}
        >
          <LogOut size={19} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}