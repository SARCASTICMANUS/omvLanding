import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Cities from "./pages/Cities";
import RoutesPage from "./pages/Routes";
import Stops from "./pages/Stops";
import TripSchedules from "./pages/TripSchedules";
import Users from "./pages/Users";
import Sidebar from "./components/Sidebar";
import api from "./api/client";

const ADMIN_PATH = "/zxcv";

function AdminLayout({ onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "cities", label: "Cities" },
    { id: "routes", label: "Routes" },
    { id: "stops", label: "Stops" },
    { id: "schedules", label: "Schedules" },
    { id: "users", label: "Users" },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
      />
      <main className="flex-1 overflow-hidden">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "cities" && <Cities />}
        {activeTab === "routes" && <RoutesPage />}
        {activeTab === "stops" && <Stops />}
        {activeTab === "schedules" && <TripSchedules />}
        {activeTab === "users" && <Users />}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      api
        .get("/accounts/me/")
        .then((res) => {
          const u = res.data?.data || res.data;
          if (u.role !== "admin" && !u.is_staff) throw new Error("Not admin");
          setUser(u);
        })
        .catch(() => {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_refresh");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    navigate(ADMIN_PATH);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_refresh");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path={ADMIN_PATH}
        element={
          user ? (
            <AdminLayout onLogout={handleLogout} />
          ) : (
            <Login onLogin={handleLogin} />
          )
        }
      />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/admin" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
