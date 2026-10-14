// VAYY | src/services/api/dynamicRouteService.js | Status: 🆕 Dynamic route creation
//
// Single API surface for backend-generated routes (OSRM road geometry + PostGIS
// corridor stops). It reuses the one existing authenticated axios client
// (src/lib/api.js) so auth, token refresh and base URL handling stay identical
// to every other request in the app. There is deliberately no second HTTP
// client and no client-side routing provider.

import api from "./client";
import { API_PATHS } from "../../constants/apiPaths";

/* LocationSearch hands over { display_name, lat, lon }. Everything in the app
   uses `lon` while the dynamic-route contract uses `lng`, so normalise once
   here instead of leaking two coordinate dialects through the UI. */
const toContractPoint = (point) => {
  const lat = Number(point?.lat ?? point?.latitude ?? point?.y);
  const lng = Number(point?.lon ?? point?.lng ?? point?.longitude ?? point?.x);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
};

const buildPreviewPayload = ({
  cityId,
  origin,
  destination,
  vehicleType,
} = {}) => ({
  // `city_id` is optional on the backend: when null it resolves the city from
  // the authenticated user's own city. Never invent a city id.
  city_id: cityId ?? null,
  origin: toContractPoint(origin),
  destination: toContractPoint(destination),
  vehicle_type: vehicleType || "bike",
});

export const dynamicRouteService = {
  /**
   * Ask the backend to generate a route between two points.
   * Returns the raw axios response (response interceptor does not unwrap `.data`),
   * matching every other service in this folder.
   */
  preview: ({ cityId, origin, destination, vehicleType } = {}) =>
    api.post(API_PATHS.transport.routeDynamicPreview, buildPreviewPayload({
      cityId,
      origin,
      destination,
      vehicleType,
    })),

  /**
   * Persist the generated route as a dynamic journey so downstream steps
   * (raise hand / dispatch) can reference it by a real identifier.
   * Only used once the backend exposes it; the preview endpoint stays the
   * default data source for the Route Card.
   */
  generate: ({ cityId, origin, destination, vehicleType } = {}) =>
    api.post(API_PATHS.transport.routeDynamicGenerate, buildPreviewPayload({
      cityId,
      origin,
      destination,
      vehicleType,
    })),
};

export default dynamicRouteService;
