import api, { normalizeApiError } from "../../shared/lib/api";
import { TRANSPORT } from "../../constants";

export const fetchLibraryRoutes = async (params = {}) => {
  try {
    const response = await api.get(TRANSPORT.routes, { params });
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch library routes:", error);
    return [];
  }
};

export const createRoute = async (routeData) => {
  try {
    const response = await api.post(TRANSPORT.routes, routeData);
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to create route.");
  }
};

export const updateRoute = async (routeId, routeData) => {
  try {
    const response = await api.patch(`${TRANSPORT.routes}${routeId}/`, routeData);
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to update route.");
  }
};

export const deleteRoute = async (routeId) => {
  try {
    await api.delete(`${TRANSPORT.routes}${routeId}/`);
  } catch (error) {
    throw normalizeApiError(error, "Unable to delete route.");
  }
};

export const recalculateRouteDistance = async (routeId) => {
  try {
    const response = await api.post(`${TRANSPORT.routes}${routeId}/recalculate_distance/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to recalculate route distance.");
  }
};

export const fetchCities = async () => {
  try {
    const response = await api.get(TRANSPORT.cities);
    return response.data?.data || response.data;
  } catch (error) {
    console.error("Failed to fetch cities:", error);
    return [];
  }
};

export default {
  fetchLibraryRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  recalculateRouteDistance,
  fetchCities,
};
