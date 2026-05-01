import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

export default function DashboardPage() {
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  if (!isAuthenticated || !user?.role) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role) {
    case "admin":
    case "city_admin":
    case "university_admin":
      return <Navigate to="/admin" replace />;

    case "driver":
      return <Navigate to="/driver/live" replace />;

    case "passenger":
    case "student":
      return <Navigate to="/passenger/live" replace />;

    default:
      return <Navigate to="/login" replace />;
  }
}