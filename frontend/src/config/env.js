const parseFlag = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return fallback;
};

export const env = {
  apiUrl: import.meta.env.VITE_API_URL || "https://onmyvayy.com",
  appName: import.meta.env.VITE_APP_NAME || "OMV",
  cityCode: import.meta.env.VITE_CITY_CODE || "default",
  socketReconnectAttempts: Number(import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || 8),
  socketReconnectBaseDelay: Number(import.meta.env.VITE_SOCKET_RECONNECT_BASE_DELAY || 800),

  // ==========================================================================
  // DYNAMIC ROUTE CREATION
  //
  // true  -> route creation asks the backend to generate a route
  //          (POST /api/transport/routes/dynamic-preview/) and the existing
  //          Route Card renders the generated geometry, stops and fare.
  // false -> rollback path. Route creation goes back to the legacy
  //          manually traced fixed-route lookup, which is still fully
  //          implemented and untouched.
  //
  // This is the single source of truth for the switch. The decision is read at
  // the route-data retrieval boundary only (see src/services/routes/routeProvider.js)
  // so no feature-flag checks leak into UI components.
  // ==========================================================================
  dynamicRouteCreationEnabled: parseFlag(
    import.meta.env.VITE_DYNAMIC_ROUTE_CREATION_ENABLED,
    true,
  ),
};
