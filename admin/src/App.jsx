import { useState, useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import DriverVerification from "./pages/DriverVerification";
import Sidebar from "./components/Sidebar";
import { PageLoader } from "./components/Loader";
import api from "./api/client";
import usePageView from "./hooks/usePageView";

const LandingPageAnimated = lazy(() => import("./pages/LandingPageAnimated"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cities = lazy(() => import("./pages/Cities"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const RouteExplorerPage = lazy(() => import("./pages/RouteExplorer"));
const KPIPage = lazy(() => import("./pages/KPI"));
const Stops = lazy(() => import("./pages/Stops"));
// const TripSchedules = lazy(() => import("./pages/TripSchedules"));
const Users = lazy(() => import("./pages/Users"));
const Zones = lazy(() => import("./pages/Zones"));

const ADMIN_PATH = "/zxcv";

function AdminLayout({ onLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pageSubtitle, setPageSubtitle] = useState(null);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("kpitrack", { detail: { page: `/zxcv/${activeTab}` } })
    );
  }, [activeTab]);

  useEffect(() => {
    const handler = (e) => setPageSubtitle(e?.detail ?? null);
    window.addEventListener("pagesubtitle", handler);
    return () => window.removeEventListener("pagesubtitle", handler);
  }, []);

  const tabs = [
    { id: "dashboard", label: "Dashboard", description: "Platform overview at a glance" },
    { id: "kpi", label: "KPI & Analytics" },
    { id: "cities", label: "Cities", description: "City networks and route hubs" },
    { id: "route-explorer", label: "Route Explorer", description: "Routes visualized on the interactive map" },
    { id: "routes", label: "Routes", description: "Route library, creation and imports" },
    { id: "stops", label: "Stops", description: "Stops across every city" },
    { id: "zones", label: "Zone", description: "Zone-based fares and scheduling" },
    // { id: "schedules", label: "Schedules" },
    { id: "drivers", label: "Drivers", description: "Driver onboarding and verification" },
    { id: "users", label: "Users", description: "Passengers and drivers directory" },
  ];

  const activeTabInfo = tabs.find((t) => t.id === activeTab);

  return (
    <div className="relative h-screen overflow-hidden p-3 md:p-4 lg:p-5" style={{ background: "linear-gradient(135deg, #EAF0FF 0%, #E8EEFF 25%, #F1ECFF 48%, #EFF6FF 72%, #EAF0FF 100%)" }}>
      {/* Ambient gradient blobs — the back-most backdrop, behind the glass shell */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="gradient-blob blob-primary w-[420px] h-[420px] -top-24 -left-20 animate-blob-float" />
        <div className="gradient-blob blob-sky w-[360px] h-[360px] top-[22%] -right-24 animate-blob-float" style={{ animationDelay: "1.4s" }} />
        <div className="gradient-blob blob-primary-light w-[300px] h-[300px] bottom-[8%] left-[22%] animate-blob-float" style={{ animationDelay: "2.8s" }} />
        <div className="gradient-blob blob-indigo w-[260px] h-[260px] bottom-[28%] -right-10 animate-blob-float" style={{ animationDelay: "1.3s" }} />
        <div className="gradient-blob blob-soft w-[280px] h-[280px] top-[60%] left-[-6%] animate-blob-float" style={{ animationDelay: "3.6s" }} />
        <div className="gradient-blob blob-deep w-[240px] h-[240px] top-[10%] left-[55%] animate-blob-float" style={{ animationDelay: "2.2s" }} />
      </div>

      <div
        className="h-full flex flex-col overflow-hidden relative z-10"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.1) 100%)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(255,255,255,0.45)",
          borderRadius: "36px",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 6px rgba(46,92,255,0.03), 0 16px 40px rgba(31,38,135,0.08), 0 40px 100px rgba(31,38,135,0.12)",
        }}
      >

        {/* Compact header row — brand (matches sidebar width) + active page title at the same level */}
        <div className="relative z-10 shrink-0 flex items-start px-6 md:px-8 pt-6 md:pt-7 pb-3">
          <div className="w-64 shrink-0">
            <h1
              className="text-2xl md:text-[30px] leading-none tracking-tight"
              style={{ fontFamily: "Geom, sans-serif", color: "#16233F" }}
            >
              <span className="font-black">OMV</span>{" "}
              <span className="font-medium text-slate-700">Admin</span>
            </h1>
            <p className="text-xs font-medium text-slate-400 mt-2">Control Panel</p>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="glass-title-sm text-2xl">{activeTabInfo?.label}</h1>
            <div className="flex items-center justify-between gap-3 mt-1">
              {(activeTabInfo?.description || (pageSubtitle?.tab === activeTab ? pageSubtitle.text : null)) && (
                <p className="text-slate-500 font-medium text-sm truncate min-w-0">
                  {activeTabInfo?.description || pageSubtitle.text}
                </p>
              )}
              <div id="page-toolbar" className="flex items-center gap-3 shrink-0" />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 min-h-0">
          <Sidebar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onLogout={onLogout}
          />
          <div className="flex-1 relative min-w-0 overflow-hidden">
          <div className="relative z-10 h-full">
            <Suspense fallback={<PageLoader />}>
              {activeTab === "dashboard" && <Dashboard />}
              {activeTab === "kpi" && <KPIPage />}
              {activeTab === "cities" && <Cities />}
              {activeTab === "route-explorer" && <RouteExplorerPage />}
              {activeTab === "routes" && <RoutesPage />}
              {activeTab === "stops" && <Stops />}
              {activeTab === "zones" && <Zones />}
              {/* {activeTab === "schedules" && <TripSchedules />} */}
              {activeTab === "drivers" && <DriverVerification />}
              {activeTab === "users" && <Users />}
            </Suspense>
          </div>
          </div>
        </div>
      </div>
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
