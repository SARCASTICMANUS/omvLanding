import {
  LayoutDashboard,
  MapPin,
  Route,
  StopCircle,
  CalendarClock,
  Users,
  LogOut,
} from "lucide-react";

const iconMap = {
  dashboard: LayoutDashboard,
  cities: MapPin,
  routes: Route,
  stops: StopCircle,
  schedules: CalendarClock,
  users: Users,
};

export default function Sidebar({ tabs, activeTab, onTabChange, onLogout }) {
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center font-black text-lg">
            V
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Vayy Admin</h1>
            <p className="text-xs text-slate-500 font-medium">Control Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {Icon && <Icon size={18} />}
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-600/10 hover:text-red-300 transition-all"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </aside>
  );
}
