// import React, { useState } from "react";
// import RoleSelection from "./components/RoleSelection";
// import MapDriver from "./components/MapDriver";
// import MapPassenger from "./components/MapPassenger";
// import "leaflet/dist/leaflet.css";
// import AdminRouteManager from './components/AdminRouteManager';

// function App() {
//   const [view, setView] = useState("home"); // 'home', 'driver', 'passenger'

//   const renderView = () => {
//     switch (view) {
//       case "driver":
//         return <MapDriver onBack={() => setView("home")} />;
//       case "passenger":
//         return <MapPassenger onBack={() => setView("home")} />;
//       case 'admin': return <AdminRouteManager onBack={() => setView('home')} />;
//       default:
//         return <RoleSelection onSelect={setView} />;
//     }
//   };

//   return (
//     <div className="h-screen w-full bg-gray-100 flex flex-col font-sans overflow-hidden">
//       {/* Global Header */}
//       <header className="bg-white shadow-sm h-14 flex items-center px-6 justify-between z-20">
//         <div
//           className="flex items-center gap-2 cursor-pointer"
//           onClick={() => setView("home")}
//         >
//           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
//             V
//           </div>
//           <span className="text-xl font-bold text-gray-800 tracking-tight">
//             Vayy
//           </span>
//         </div>
//         {view !== "home" && (
//           <button
//             onClick={() => setView("home")}
//             className="text-sm text-gray-500 hover:text-gray-800"
//           >
//             Exit {view === "driver" ? "Driver" : "Passenger"} Mode
//           </button>
//         )}
//       </header>

//       {/* Main Content Area */}
//       <main className="flex-1 relative">{renderView()}</main>
//     </div>
//   );
// }

// export default App;
// import React, { useState } from "react";
// import RoleSelection from "./components/RoleSelection";
// import MapDriver from "./components/MapDriver";
// import MapPassenger from "./components/MapPassenger";
// import AdminRouteManager from "./components/AdminRouteManager";
// import "leaflet/dist/leaflet.css";

// function App() {
//   const [view, setView] = useState("home"); // 'home', 'driver', 'passenger', 'admin'

//   const renderView = () => {
//     switch (view) {
//       case "driver":
//         return <MapDriver onBack={() => setView("home")} />;
//       case "passenger":
//         return <MapPassenger onBack={() => setView("home")} />;
//       case "admin":
//         return <AdminRouteManager onBack={() => setView("home")} />;
//       default:
//         return (
//           <div className="relative h-full w-full">
//             <RoleSelection onSelect={setView} />

//             {/* Admin Toggle Button (Bottom Right) */}
//             <div className="absolute bottom-6 right-6 z-50">
//               <button
//                 onClick={() => setView("admin")}
//                 className="bg-gray-800 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg hover:bg-black transition-all opacity-70 hover:opacity-100 flex items-center gap-2"
//               >
//                 <span>🔧</span> Admin Panel
//               </button>
//             </div>
//           </div>
//         );
//     }
//   };

//   return (
//     <div className="h-screen w-full bg-gray-100 flex flex-col font-sans overflow-hidden">
//       {/* Global Header */}
//       <header className="bg-white shadow-sm h-14 flex items-center px-6 justify-between z-20">
//         <div
//           className="flex items-center gap-2 cursor-pointer"
//           onClick={() => setView("home")}
//         >
//           <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
//             V
//           </div>
//           <span className="text-xl font-bold text-gray-800 tracking-tight">
//             Vayy
//           </span>
//         </div>
//         {view !== "home" && (
//           <button
//             onClick={() => setView("home")}
//             className="text-sm text-gray-500 hover:text-gray-800 font-medium"
//           >
//             Exit{" "}
//             {view === "admin"
//               ? "Admin"
//               : view === "driver"
//                 ? "Driver"
//                 : "Passenger"}{" "}
//             Mode
//           </button>
//         )}
//       </header>

//       {/* Main Content Area */}
//       <main className="flex-1 relative">{renderView()}</main>
//     </div>
//   );
// }

// export default App;

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import MapDriver from "./components/Maps/MapDriver";
import MapPassenger from "./components/Maps/MapPassenger";
import AdminPanel from "./pages/AdminPanel";

// Component to handle role-based redirection
const DashboardRouter = () => {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Safety check: if authenticated but user object is missing (rare edge case)
  if (!user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case "admin":
    case "university_admin":
      return <Navigate to="/admin" replace />;
    case "driver":
      return <MapDriver />;
    case "passenger":
    case "student":
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

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isAdmin = user?.role === "admin" || user?.role === "university_admin";
  if (!isAdmin) return <Navigate to="/" replace />;

  return children;
};

// Public Route (Redirects if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

function App() {
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
