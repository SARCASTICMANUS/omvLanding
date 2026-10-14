import api, { normalizeApiError } from "../../shared/lib/api";
import { TRANSPORT } from "../../constants";
import { normalizeDynamicRoutes } from "./dynamicRouteNormalizer";

// ---- Dynamic route preview (the ONLY mobile route source) ----
// POST /api/transport/routes/dynamic-preview/
// body: { city_id, origin:{lat,lng}, destination:{lat,lng}, vehicle_type }
// The legacy routes/search-by-location returns EMPTY on this backend and must
// never be used as a route source.

const DYNAMIC_PREVIEW_PATH =
  TRANSPORT.routesDynamicPreview || "/api/transport/routes/dynamic-preview/";

const toContractPoint = (point) => {
  const lat = Number(point?.lat ?? point?.latitude ?? point?.y);
  const lng = Number(point?.lng ?? point?.lon ?? point?.longitude ?? point?.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/**
 * @param {object} params
 * @param {{lat:number, lon?:number, lng?:number}} params.origin
 * @param {{lat:number, lon?:number, lng?:number}} params.destination
 * @param {"bike"|"auto"} [params.vehicleType]
 * @param {"passenger"|"driver"} [params.audience] which backend fare the card shows
 * @param {number|null} [params.cityId] null lets the backend resolve the user's city
 * @returns {Promise<{ routes: object[], cached: boolean }>}
 */
export const dynamicPreview = async ({
  origin,
  destination,
  vehicleType = "bike",
  audience = "passenger",
  cityId = null,
} = {}) => {
  const from = toContractPoint(origin);
  const to = toContractPoint(destination);
  if (!from || !to) {
    throw new Error("Pickup and destination are required.");
  }

  try {
    const response = await api.post(DYNAMIC_PREVIEW_PATH, {
      city_id: cityId ?? null,
      origin: from,
      destination: to,
      vehicle_type: vehicleType || "bike",
    });

    const body = response.data;
    const routes = normalizeDynamicRoutes(body, {
      audience,
      origin: from,
      destination: to,
    });
    const cached = body?.cached === true || body?.data?.cached === true;

    return { routes, cached };
  } catch (error) {
    throw normalizeApiError(error, "Unable to create this route.");
  }
};

// ---- Fixed-route reads (unchanged contracts) ----

export const fetchRouteDetail = async (routeId) => {
  try {
    const response = await api.get(`${TRANSPORT.routes}${routeId}/`);
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch route detail.");
  }
};

export const fetchRouteList = async (params = {}) => {
  try {
    const response = await api.get(TRANSPORT.routes, { params });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch route list.");
  }
};

export const fetchRouteGeometry = async (routeId) => {
  try {
    const response = await api.get(`${TRANSPORT.routes}${routeId}/geometry/`);
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch route geometry.");
  }
};

export const fetchRouteSchedule = async (routeId) => {
  try {
    const response = await api.get(`${TRANSPORT.routes}${routeId}/schedule/`);
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch route schedule.");
  }
};

export const previewRoute = async (start, end, stops = []) => {
  try {
    const response = await api.post(TRANSPORT.routesPreview, {
      start,
      end,
      stops,
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to preview route.");
  }
};

export const getRoadDistance = async (originLat, originLng, destLat, destLng) => {
  try {
    const response = await api.post(TRANSPORT.roadDistance, {
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch road distance.");
  }
};

export const getWalkingPath = async (originLat, originLng, destLat, destLng) => {
  try {
    const response = await api.post(TRANSPORT.walkingPath, {
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch walking path.");
  }
};

export default {
  fetchRouteDetail,
  fetchRouteList,
  fetchRouteGeometry,
  fetchRouteSchedule,
  previewRoute,
  dynamicPreview,
  getRoadDistance,
  getWalkingPath,
};
