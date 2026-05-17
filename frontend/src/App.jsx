import React, { Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import Navbar from "./components/Layout/Navbar";
import { logout } from "./features/auth/authSlice";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPanel from "./pages/AdminPanel";
import MapDriver from "./components/Maps/MapDriver";
import PassengerLivePage from "./pages/PassengerLivePage";
import IntroPage from "./components/SplashScreen/SplashScreen1";
import SplashScreen2 from "./components/SplashScreen/SplashScreen2";
import SplashScreen3 from "./components/SplashScreen/SplashScreen3";
import SplashScreen4 from "./components/SplashScreen/SplashScreen4";

import AboutPage from "./pages/AboutPage";
import ContactUsPage from "./pages/ContactUsPage";
import RoutesPage from "./pages/RoutesPage";

/* ===============================
   Helpers
================================ */
const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const getRedirectPathByRole = (role) => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "driver") {
    return "/driver/live";
  }

  if (
    normalizedRole === "admin" ||
    normalizedRole === "city_admin" ||
    normalizedRole === "university_admin" ||
    normalizedRole === "super_admin"
  ) {
    return "/admin";
  }

  if (
    normalizedRole === "passenger" ||
    normalizedRole === "student"
  ) {
    return "/passenger/live";
  }

  return "/passenger/live";
};

/* ===============================
   Loader
================================ */
const FullScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#171717] px-4">
    <div className="rounded-2xl bg-white px-6 py-4 shadow-xl">
      <p className="text-sm font-semibold text-slate-700">Loading...</p>
    </div>
  </div>
);

/* ===============================
   Unknown Role
================================ */
const UnknownRoleScreen = ({ role }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Unknown Role</h1>
      <p className="mb-6 text-sm text-slate-600">
        Invalid account role detected.
      </p>

      <div className="mb-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Role: <span className="font-semibold">{role || "N/A"}</span>
      </div>

      <button
        onClick={() => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace("/login");
        }}
        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Back to Login
      </button>
    </div>
  </div>
);

/* ===============================
   Auth Guards
================================ */
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getRedirectPathByRole(role)} replace />;
  }

  return children;
};

const ProtectedAdmin = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin =
    role === "admin" ||
    role === "city_admin" ||
    role === "university_admin" ||
    role === "super_admin";

  if (!isAdmin) {
    return <UnknownRoleScreen role={user?.role} />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (isAuthenticated) {
    return <Navigate to={getRedirectPathByRole(role)} replace />;
  }

  return children;
};

/* ===============================
   Root Redirect
================================ */
const RootRedirect = () => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getRedirectPathByRole(role)} replace />;
};

/* ===============================
   App Layout (Header everywhere)
================================ */
const AppLayout = ({ children, showNavbar = true, flush = false }) => {
  return (
    <div className={`min-h-screen bg-slate-50 w-full overflow-x-hidden relative ${showNavbar && !flush ? 'pt-[64px] sm:pt-[57px]' : ''}`}>
      {showNavbar && <Navbar />}
      <main className="w-full">{children}</main>
    </div>
  );
};

/* ===============================
   APP
================================ */
function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");

    if (!token) return;

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded?.exp && decoded.exp < now) {
        if (!refreshToken) {
          localStorage.clear();
          sessionStorage.clear();
          dispatch(logout());
        }
      }
    } catch (error) {
      localStorage.clear();
      sessionStorage.clear();
      dispatch(logout());
    }
  }, [dispatch]);

  return (
    <Router>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          {/* PUBLIC */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* ADMIN */}
          <Route
            path="/admin"
            element={
              <ProtectedAdmin>
                <AppLayout showNavbar={false}>
                  <AdminPanel />
                </AppLayout>
              </ProtectedAdmin>
            }
          />

          {/* DRIVER */}
          <Route
            path="/driver/live"
            element={
              <ProtectedRoute allowedRoles={["driver"]}>
                <AppLayout flush={true}>
                  <MapDriver />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* PASSENGER */}
          <Route
            path="/passenger/live"
            element={
              <ProtectedRoute allowedRoles={["passenger", "student"]}>
                <AppLayout>
                  <PassengerLivePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* DEFAULT LANDING */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <AppLayout>
                  <IntroPage />
                </AppLayout>
              </PublicRoute>
            }
          />
          <Route
            path="/splash2"
            element={
              <PublicRoute>
                <AppLayout>
                  <SplashScreen2 />
                </AppLayout>
              </PublicRoute>
            }
          />
          <Route
            path="/splash3"
            element={
              <PublicRoute>
                <AppLayout>
                  <SplashScreen3 />
                </AppLayout>
              </PublicRoute>
            }
          />
          <Route
            path="/splash4"
            element={
              <PublicRoute>
                <AppLayout>
                  <SplashScreen4 />
                </AppLayout>
              </PublicRoute>
            }
          />
          
          <Route path="/about" element={<AppLayout><AboutPage /></AppLayout>} />
          <Route path="/contact" element={<AppLayout><ContactUsPage /></AppLayout>} />
          <Route path="/routes" element={<AppLayout><RoutesPage /></AppLayout>} />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
