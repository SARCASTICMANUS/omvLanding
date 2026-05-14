import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { logout } from "../features/auth/authSlice";
import AdminRouteManager from "../components/AdminRouteManager";
import CityManager from "../components/CityManager";
import AdminUsersManager from "../components/AdminUsersManager";
import PassengersManager from "../components/PassengersManager";
import VehiclesManager from "../components/VehiclesManager";
import DriversManager from "../components/DriversManager";
import { useSelector } from "react-redux";
import {
  LayoutDashboard,
  Route as RouteIcon,
  MapPin,
  BarChart3,
  Users,
  LogOut,
  Bus,
  UserCheck,
  UserSquare,
} from "lucide-react";

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const FULL_ADMIN_ROLES = new Set([
  "admin",
  "city_admin",
  "cityadmin",
  "super_admin",
  "superadmin",
]);

const AdminPanel = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const role = normalizeRole(user?.role);
  const canSeeAllAdminItems = FULL_ADMIN_ROLES.has(role);
  const cityId = user?.city;

  const [activeTab, setActiveTab] = useState(canSeeAllAdminItems ? "cities" : "passengers");

  const navItems = [
    // Admin modules
    { id: "passengers", label: "Passengers", icon: <UserSquare size={18} />, hidden: !canSeeAllAdminItems },
    { id: "routes", label: "Routes", icon: <RouteIcon size={18} /> },
    { id: "vehicles", label: "Vehicles", icon: <Bus size={18} />, hidden: !canSeeAllAdminItems },
    { id: "drivers", label: "Drivers", icon: <UserCheck size={18} />, hidden: !canSeeAllAdminItems },
    { id: "cities", label: "Cities", icon: <MapPin size={18} />, hidden: !canSeeAllAdminItems },
    { id: "users", label: "Users", icon: <Users size={18} />, hidden: !canSeeAllAdminItems },
    { id: "stats", label: "Stats", icon: <BarChart3 size={18} /> },
  ];

  const visibleNavItems = navItems.filter(item => !item.hidden);

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
          {visibleNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 py-3.5 px-5 rounded-2xl transition duration-300 font-bold text-sm ${activeTab === item.id
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
        {activeTab === "passengers" && <PassengersManager cityId={cityId} />}
        {activeTab === "vehicles" && <VehiclesManager cityId={cityId} />}
        {activeTab === "drivers" && <DriversManager cityId={cityId} />}
        {activeTab === "routes" && (
          <AdminRouteManager preSelectedCity={cityId} onBack={() => setActiveTab("routes")} />
        )}
        {activeTab === "cities" && <CityManager />}
        {activeTab === "users" && <AdminUsersManager />}
        {activeTab === "stats" && (
          <div className="flex items-center justify-center h-full text-slate-400 font-bold bg-slate-50">
            <div className="text-center">
              <div className="mb-4 flex justify-center opacity-20">
                <BarChart3 size={120} />
              </div>
              <p className="text-xl">Coming Soon</p>
              <p className="text-sm">We are working on this stats module</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
