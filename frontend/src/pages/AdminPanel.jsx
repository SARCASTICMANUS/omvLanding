import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import AdminRouteManager from "../components/AdminRouteManager";
import UniversityManager from "../components/UniversityManager";
import {
  LayoutDashboard,
  Route as RouteIcon,
  School,
  BarChart3,
  Users,
  LogOut,
} from "lucide-react";

const AdminPanel = () => {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("routes"); // 'routes' or 'universities'

  const navItems = [
    { id: "routes", label: "Routes", icon: <RouteIcon size={18} /> },
    { id: "universities", label: "Universities", icon: <School size={18} /> },
    { id: "users", label: "Users", icon: <Users size={18} /> },
    { id: "stats", label: "Stats", icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-white font-sans">
      {/* --- Sidebar --- */}
      <div className="w-72 bg-slate-900 text-white flex flex-col p-6 shadow-2xl z-[1100]">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <LayoutDashboard size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">Vayy Admin</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 py-3.5 px-5 rounded-2xl transition duration-300 font-bold text-sm ${
                activeTab === item.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={() => dispatch(logout())}
          className="flex items-center gap-3 bg-red-600/10 text-red-500 py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition duration-300"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab === "routes" && (
          <AdminRouteManager onBack={() => setActiveTab("routes")} />
        )}
        {activeTab === "universities" && <UniversityManager />}
        {(activeTab === "users" || activeTab === "stats") && (
          <div className="flex items-center justify-center h-full text-slate-400 font-bold bg-slate-50">
            <div className="text-center">
              <div className="mb-4 flex justify-center opacity-20">
                {activeTab === "users" ? (
                  <Users size={120} />
                ) : (
                  <BarChart3 size={120} />
                )}
              </div>
              <p className="text-xl">Coming Soon</p>
              <p className="text-sm">We are working on this module</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
