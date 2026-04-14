import React, { Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { jwtDecode } from "jwt-decode";

import Header from "./components/Layout/Header";
import { logout } from "./features/auth/authSlice";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPanel from "./pages/AdminPanel";
import MapDriver from "./components/Maps/MapDriver";
import PassengerLivePage from "./pages/PassengerLivePage";

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
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const ProtectedAdmin = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated || !user?.role) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin =
    user.role === "admin" ||
    user.role === "city_admin" ||
    user.role === "university_admin";

  if (!isAdmin) {
    return <UnknownRoleScreen role={user.role} />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);

  if (isAuthenticated) {
    return <Navigate to="/passenger/live" replace />;
  }

  return children;
};

/* ===============================
   App Layout (Header everywhere)
================================ */
const AppLayout = ({ children }) => {
  return (
    <div >
      <Header />
      <main >{children}</main>
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
          dispatch(logout());
        }
      }
    } catch {
      localStorage.clear();
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

          {/* PROTECTED WITH HEADER */}
          <Route
            path="/admin"
            element={
              <ProtectedAdmin>
                <AppLayout>
                  <AdminPanel />
                </AppLayout>
              </ProtectedAdmin>
            }
          />

          <Route
            path="/driver/live"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MapDriver />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/passenger/live"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PassengerLivePage />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* DEFAULT LANDING */}
          <Route
            path="/"
            element={<Navigate to="/passenger/live" replace />}
          />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;