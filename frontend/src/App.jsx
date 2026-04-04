import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "./features/auth/authSlice";
import { jwtDecode } from "jwt-decode";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MapDriver from "./components/Maps/MapDriver";
import MapPassenger from "./components/Maps/MapPassenger";
import AdminPanel from "./pages/AdminPanel";

// Component to handle role-based redirection
const DashboardRouter = () => {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated || !user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case "admin":
    case "city_admin":
      return <Navigate to="/admin" replace />;
    case "driver":
      return <MapDriver />;
    case "passenger":
    case "student": // legacy compat
      return <MapPassenger />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white p-8 rounded-xl shadow-lg text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Unknown Role
            </h1>
            <p className="text-gray-600 mb-4">Role: {user.role}</p>
            <button
              onClick={() => (window.location.href = "/login")}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg"
            >
              Go Back to Login
            </button>
          </div>
        </div>
      );
  }
};

// Protected Admin Route
const ProtectedAdmin = ({ children }) => {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "city_admin" ||
    user?.role === "university_admin"; // legacy compat
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
};

// Public Route (Redirects if already logged in)
const PublicRoute = ({ children }) => {
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  // Only redirect if FULLY authenticated with a role
  if (isAuthenticated && user && user.role) {
    return <Navigate to="/" replace />;
  }
  return children;
};


function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        // If token explicitly expired (without relying solely on interceptor)
        if (decoded.exp < currentTime) {
          // The api.js interceptor will try to use the refresh token on the next request.
          // Or we can pre-emptively try refreshing here, but for simplicity, 
          // letting the interceptor catch the 401 is usually sufficient. 
          // However, if we know it's expired and we don't have a refresh token:
          if (!localStorage.getItem("refreshToken")) {
            dispatch(logout());
          }
        }
      } catch (e) {
        // Invalid token format
        dispatch(logout());
      }
    }
  }, [dispatch]);

  return (
    <Router>
      <Routes>
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

        {/* Main Dashboard (Protected) */}
        <Route path="/" element={<DashboardRouter />} />

        {/* Admin Panel (Protected) */}
        <Route
          path="/admin"
          element={
            <ProtectedAdmin>
              <AdminPanel />
            </ProtectedAdmin>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
