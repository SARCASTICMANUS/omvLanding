import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ADMIN_ROLES } from "../constants/roles";
import { APP_ROUTES } from "../constants/routes";
import { getRedirectPathByRole, normalizeRole } from "../utils/roles";

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (!isAuthenticated) {
    return <Navigate to={APP_ROUTES.login} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getRedirectPathByRole(role)} replace />;
  }

  return children;
};

export const ProtectedAdmin = ({ children, fallback = null }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (!isAuthenticated || !role) {
    return <Navigate to={APP_ROUTES.login} replace />;
  }

  if (!ADMIN_ROLES.includes(role)) {
    return fallback || <Navigate to={getRedirectPathByRole(role)} replace />;
  }

  return children;
};

export const PublicRoute = ({ children }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const role = normalizeRole(user?.role);

  if (isAuthenticated) {
    return <Navigate to={getRedirectPathByRole(role)} replace />;
  }

  return children;
};

