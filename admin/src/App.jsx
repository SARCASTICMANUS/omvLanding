 import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import DriverVerification from "./pages/DriverVerification";
import Sidebar from "./components/Sidebar";
import api from "./api/client";
import usePageView from "./hooks/usePageView";

const LandingPageAnimated = lazy(() => import("./pages/LandingPageAnimated"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const SplashPreview = lazy(() => import("./pages/SplashPreview"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cities = lazy(() => import("./pages/Cities"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const RouteExplorerPage = lazy(() => import("./pages/RouteExplorer"));
const KPIPage = lazy(() => import("./pages/KPI"));
const Stops = lazy(() => import("./pages/Stops"));
const TripSchedules = lazy(() => import("./pages/TripSchedules"));
const Users = lazy(() => import("./pages/Users"));
const Zones = lazy(() => import("./pages/Zones"));

const ADMIN_PATH = "/zxcv";

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent" />
    </div>
  );
}

function AdminLayout({ onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const page = `/zxcv/${activeTab}`;

    const ua = navigator.userAgent;
    let deviceType = "desktop";
    if (/tablet|ipad|playbook|silk/i.test(ua)) deviceType = "tablet";
    else if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) deviceType = "mobile";

    api.post("/kpi/track/", {
      platform: "web",
      page,
      user_agent: ua,
      referrer: document.referrer || "",
      device_type: deviceType,
    }).catch(() => {});
  }, [activeTab]);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "kpi", label: "KPI & Analytics" },
    { id: "cities", label: "Cities" },
    { id: "route-explorer", label: "Route Explorer" },
    { id: "routes", label: "Routes" },
    { id: "stops", label: "Stops" },
    { id: "zones", label: "Zone" },
    { id: "schedules", label: "Schedules" },
    { id: "drivers", label: "Drivers" },
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
        <Suspense fallback={<PageLoader />}>
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "kpi" && <KPIPage />}
          {activeTab === "cities" && <Cities />}
          {activeTab === "route-explorer" && <RouteExplorerPage />}
          {activeTab === "routes" && <RoutesPage />}
          {activeTab === "stops" && <Stops />}
          {activeTab === "zones" && <Zones />}
          {activeTab === "schedules" && <TripSchedules />}
          {activeTab === "drivers" && <DriverVerification />}
        {activeTab === "users" && <Users />}
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  usePageView();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      api
        .get("/accounts/me/")
        .then((res) => {
          const u = res.data?.data || res.data;
          if (!u || (u.role !== "admin" && !u.is_staff)) {
            throw new Error("Not admin");
          }
          setUser(u);
        })
        .catch((err) => {
          // Only clear tokens on 401 (unauthorized) — not on network errors or server issues
          if (err.response?.status === 401) {
            localStorage.removeItem("admin_token");
            localStorage.removeItem("admin_refresh");
          }
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

  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPageAnimated />} />
        <Route path="/splash-preview" element={<SplashPreview />} />
        <Route path="/support" element={
          <>
            <LandingPageAnimated />
            <SupportPage />
          </>
        } />
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
    </Suspense>
  );
}
