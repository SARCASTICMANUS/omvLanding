import api, { normalizeApiError } from "../../shared/lib/api";
import { TRANSPORT } from "../../constants";
import { extractDynamicRoutePayloads, normalizeDynamicRoutes } from "./dynamicRouteNormalizer";
import { requireServiceCityId } from "./serviceCityMatching";

// ---- OSRM route generation from nearest global stops ----
// POST /api/transport/routes/dynamic-generate/
// body: { city_id, origin:{lat,lng}, destination:{lat,lng}, vehicle_type }
// The legacy routes/search-by-location returns EMPTY on this backend and must
// never be used as a route source.

const DYNAMIC_ROUTE_PATH =
  TRANSPORT.routesDynamicGenerate || "/api/transport/routes/dynamic-generate/";

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
 * @param {string|null} [params.cityId] explicit city id; omit/null to let the
 *   authenticated backend resolve it from the account, pickup, and active city config.
 * @returns {Promise<{ routes: object[], cached: boolean, cityId: string|null }>}
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

  // The backend owns city assignment; a client centroid cutoff can reject valid
  // pickups inside the service area, and a failed city-list request is not proof
  // that the pickup is outside every supported city.
  const resolvedCityId = requireServiceCityId(cityId);

  try {
    const response = await api.post(DYNAMIC_ROUTE_PATH, {
      city_id: resolvedCityId ?? null,
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
    if (extractDynamicRoutePayloads(body).length && !routes.length) {
      throw new Error("The server returned a route, but the app couldn't display its geometry or stops. Ask an admin to review this route's stop coordinates and route data.");
    }
    const cached = body?.cached === true || body?.data?.cached === true;
    const responseCityId = body?.data?.city?.id ?? body?.city?.id ?? resolvedCityId;

    return {
      routes, cached, cityId: responseCityId ?? null,
      emptyReason: body?.data?.empty_reason ?? body?.empty_reason ?? null,
      emptyMessage: body?.data?.message ?? body?.message ?? null,
    };
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

export const getRoadDirections = async (originLat, originLng, destLat, destLng) => {
  try {
    const response = await api.post(TRANSPORT.roadDirections, {
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch driving directions to pickup.");
  }
};

export const getWalkingPath = async (originLat, originLng, destLat, destLng, cityId = null) => {
  try {
    const response = await api.post(TRANSPORT.walkingPath, {
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
      ...(cityId ? { city_id: cityId } : {}),
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch the road path to your pickup stop.");
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
  getRoadDirections,
  getWalkingPath,
};
