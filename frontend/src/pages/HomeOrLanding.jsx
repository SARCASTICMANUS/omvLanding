import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import HomeVayy from "./HomeVayy";
import PassengerHome from "../features/passenger/components/PassengerHome";
import { APP_ROUTES } from "../constants/routes";
import { ADMIN_ROLES, DRIVER_ROLES } from "../constants/roles";
import { normalizeRole } from "../utils/roles";

/**
 * Root landing:
 *  - guest              → public marketing landing (HomeVayy)
 *  - admin              → admin console
 *  - driver (bike/auto) → driver flow home (planner)
 *  - passenger          → app home (mobile PassengerHome / IntroPage parity)
 */
export default function HomeOrLanding() {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (!isAuthenticated) {
    return <HomeVayy />;
  }

  if (ADMIN_ROLES.includes(role)) {
    return <Navigate to={APP_ROUTES.admin} replace />;
  }

  if (DRIVER_ROLES.includes(role)) {
    return <Navigate to={APP_ROUTES.driverLive} replace />;
  }

  return <PassengerHome />;
}
