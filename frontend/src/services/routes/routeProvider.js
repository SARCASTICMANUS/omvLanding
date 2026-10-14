// VAYY | src/services/routes/routeProvider.js | Status: 🆕 Dynamic route creation
//
// ============================================================================
// ROUTE PROVIDER — the single place the DYNAMIC_ROUTE_CREATION_ENABLED decision
// is evaluated for route data retrieval.
// ============================================================================
//
// Both route-creation flows (DriverFlow and PassengerFlow) call
// `fetchDynamicRoutes(...)` when the flag is on and fall back to their existing
// fixed-route lookup when it is off. Nothing below this boundary knows which
// mode is active, so there are no scattered flag checks in components.
//
// Errors are converted to a single user-safe message here: raw OSRM/Django
// messages never reach the UI.
// ============================================================================

import { env } from "../../config/env";
import { dynamicRouteService } from "../api/dynamicRouteService";
import { normalizeDynamicRoutes } from "./dynamicRouteNormalizer";

/* User-facing copy. Deliberately generic — no OSRM, status code or stack text. */
export const DYNAMIC_ROUTE_ERROR_MESSAGE =
  "Couldn't create this route. Please try again.";

export const isDynamicRouteCreationEnabled = () =>
  Boolean(env.dynamicRouteCreationEnabled);

const hasUsablePoint = (point) => {
  const lat = Number(point?.lat ?? point?.latitude ?? point?.y);
  const lng = Number(point?.lon ?? point?.lng ?? point?.longitude ?? point?.x);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

/**
 * Request a route from the backend Dynamic Route API and return it already
 * normalised into the shape the existing Route Card renders.
 *
 * @param {object}  params
 * @param {"driver"|"passenger"} params.audience  picks which backend fare the card shows
 * @param {object}  params.origin      existing selected origin ({ lat, lon } from LocationSearch)
 * @param {object}  params.destination existing selected destination
 * @param {*}       params.cityId      authenticated user's city (null lets the backend resolve it)
 * @param {string}  params.vehicleType "bike" | "auto"
 * @returns {Promise<{ source: "dynamic", routes: object[] }>}
 * @throws  {Error} with a user-safe message when the backend cannot generate a route
 */
export const fetchDynamicRoutes = async ({
  audience = "driver",
  origin = null,
  destination = null,
  cityId = null,
  vehicleType = "bike",
} = {}) => {
  if (!hasUsablePoint(origin) || !hasUsablePoint(destination)) {
    const error = new Error(DYNAMIC_ROUTE_ERROR_MESSAGE);
    error.isDynamicRouteError = true;
    throw error;
  }

  try {
    const response = await dynamicRouteService.preview({
      cityId,
      origin,
      destination,
      vehicleType,
    });

    const routes = normalizeDynamicRoutes(response?.data, {
      audience,
      cityLabel:
        typeof cityId === "object" && cityId ? cityId.name || "" : "",
    });

    return { source: "dynamic", routes };
  } catch (error) {
    // Keep the diagnostic for engineers, expose only safe copy to the UI.
    console.error("Dynamic route creation failed", error);

    const safeError = new Error(DYNAMIC_ROUTE_ERROR_MESSAGE);
    safeError.isDynamicRouteError = true;
    safeError.cause = error;
    throw safeError;
  }
};

export default fetchDynamicRoutes;
