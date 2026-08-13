import { ROLE_ROUTES, APP_ROUTES } from "../constants/routes";

export const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

export const getRedirectPathByRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return ROLE_ROUTES[normalizedRole] || APP_ROUTES.passengerLive;
};

