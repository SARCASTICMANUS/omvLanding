import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { DRIVER_ROLES } from "../constants/roles";
import DriverFlow from "../driver/components/DriverFlow";

export default function DriverLivePage() {
  const { user } = useSelector((state) => state.auth || {});

  if (user?.role && !DRIVER_ROLES.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <DriverFlow />;
}
