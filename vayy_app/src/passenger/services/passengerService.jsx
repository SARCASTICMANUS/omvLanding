import api, { normalizeApiError } from "../../shared/lib/api";
import { AUTH, OPERATIONS, TRANSPORT, TRACKING, RIDE } from "../../constants";

/**
 * Fetch passenger dashboard data (active trips, etc.)
 */
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
 * The signed-in passenger's own boarding requests.
 *
 * Each settled one carries the segment the passenger actually rode and the fare
 * they were charged, which is what their fare screen renders.
 */
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
export const getRideHistory = async () => {
  try {
    const response = await api.get(RIDE.history);
    return response.data?.data || response.data?.results || response.data || [];
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch ride history.");
  }
};

/**
 * Find live vehicles running the corridor between two points.
 *
 * This is what the trip planner's single button calls: it resolves the road
 * between the searched pickup and destination and returns the vehicles whose
 * journey serves a stop on it. Read-only - nothing is created.
 */
export const searchCorridorVehicles = async (origin, destination, options = {}) => {
  try {
    const response = await api.post(TRACKING.corridorVehicles, {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      ...(options.radius ? { radius: options.radius } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    });
    const data = response.data?.data || response.data || {};
    return {
      path: data.path || [],
      stops: data.stops || [],
      vehicles: data.vehicles || [],
      distance_m: data.distance_m ?? null,
      duration_s: data.duration_s ?? null,
      origin: data.origin || null,
      destination: data.destination || null,
    };
  } catch (error) {
    throw normalizeApiError(error, "Could not find vehicles on this route.");
  }
};

/**
 * Raise a hand at a global stop.
 *
 * `routeId` is intentionally not sent: omitting it makes the request
 * journey-scoped, so it is offered to the drivers whose journeys pass the stop
 * instead of to whoever happens to run a fixed route.
 */
export const raiseHandAtStop = async ({ pickupStopId, dropStopId, lat, lon }) => {
  try {
    const response = await api.post(TRACKING.raiseHand, {
      pickup_stop_id: String(pickupStopId),
      ...(dropStopId ? { dropoff_stop_id: String(dropStopId) } : {}),
      lat: Number(lat),
      lng: Number(lon),
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to raise your hand.");
  }
};

// No default export: every consumer imports the named functions directly, and
// the old default object listed several helpers that nothing called.
