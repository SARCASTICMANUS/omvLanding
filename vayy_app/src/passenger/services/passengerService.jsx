import api, { normalizeApiError } from "../../shared/lib/api";
import { AUTH, OPERATIONS, TRANSPORT, TRACKING, RIDE } from "../../constants";

/**
 * Fetch passenger dashboard data (active trips, etc.)
 */
export const getPassengerDashboard = async (params) => {
  try {
    const response = await api.get(OPERATIONS.trips, { params });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch passenger dashboard.");
  }
};

/**
 * Fetch recent searches for the passenger
 */
export const getRecentSearches = async () => {
  try {
    const response = await api.get(AUTH.recentSearches);
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch recent searches:", error);
    return [];
  }
};

/**
 * Save a recent search for the passenger
 */
export const saveRecentSearch = async (searchData) => {
  try {
    await api.post(AUTH.recentSearches, searchData);
  } catch (error) {
    console.error("Failed to save recent search:", error);
  }
};

/**
 * Fetch nearby stops
 */
export const getNearbyStops = async (lat, lon, radius = 1500) => {
  try {
    const response = await api.get(TRANSPORT.stopsNearby, {
      params: { lat, lng: lon, radius },
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch nearby stops.");
  }
};

/**
 * Fetch nearby vehicles (autos/bikes) near a location.
 */
export const getNearbyVehicles = async (lat, lng, vehicleType = "auto", radius = 2000) => {
  try {
    const response = await api.get(TRACKING.nearbyVehicles, {
      params: { lat, lng, vehicle_type: vehicleType, radius },
    });
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to fetch nearby vehicles:", error);
    return [];
  }
};

/**
 * Create a boarding request for a trip at a specific stop.
 * Backend uses /api/operations/boarding-requests/.
 */
export const createBoardingRequest = async (tripId, stopId) => {
  try {
    const response = await api.post(OPERATIONS.boardingRequests, {
      trip: tripId,
      pickup_stop: stopId,
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to create boarding request.");
  }
};

/**
 * Cancel a boarding request.
 */
export const cancelBoardingRequest = async (requestId) => {
  try {
    const response = await api.delete(`${OPERATIONS.boardingRequests}${requestId}/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to cancel boarding request.");
  }
};

/**
 * Search for routes that have stops near both origin and destination.
 */
export const searchRoutesByLocation = async (originLat, originLng, destLat, destLng, radius = 5000) => {
  try {
    const response = await api.get(TRANSPORT.routesSearchByLocation, {
      params: {
        origin_lat: originLat,
        origin_lng: originLng,
        dest_lat: destLat,
        dest_lng: destLng,
        radius,
        role: "passenger",
      },
    });
    const data = response.data?.data || response.data;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Failed to search routes by location:", error);
    return [];
  }
};

/**
 * Fetch full route detail including stops and schedules.
 */
export const getRouteDetail = async (routeId) => {
  try {
    const response = await api.get(`${TRANSPORT.routes}${routeId}/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch route details.");
  }
};

/**
 * Fetch route geometry (OSRM-backed LineString)
 */
export const getRouteGeometry = async (routeId) => {
  try {
    const response = await api.get(`${TRANSPORT.routes}${routeId}/geometry/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch route geometry.");
  }
};

export const getRideHistory = async () => {
  try {
    const response = await api.get(RIDE.history);
    return response.data?.data || response.data?.results || response.data || [];
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch ride history.");
  }
};

export default {
  getPassengerDashboard,
  getRecentSearches,
  saveRecentSearch,
  getNearbyStops,
  getNearbyVehicles,
  createBoardingRequest,
  cancelBoardingRequest,
  getRouteDetail,
  getRouteGeometry,
  searchRoutesByLocation,
  getRideHistory,
};
