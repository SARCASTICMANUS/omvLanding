import api, { normalizeApiError } from "../../shared/lib/api";
import { TRANSPORT } from "../../constants";

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

export const searchRoutesByLocation = async (
  originLat, originLng, destLat, destLng, radius = 1000
) => {
  try {
    const response = await api.get(TRANSPORT.routesSearchByLocation, {
      params: {
        origin_lat: originLat,
        origin_lng: originLng,
        dest_lat: destLat,
        dest_lng: destLng,
        radius,
      },
    });
    return response.data?.data || response.data;
  } catch (error) {
    console.error("Failed to search routes by location:", error);
    return [];
  }
};

export default {
  fetchRouteDetail,
  fetchRouteList,
  fetchRouteGeometry,
  fetchRouteSchedule,
  previewRoute,
  searchRoutesByLocation,
};
