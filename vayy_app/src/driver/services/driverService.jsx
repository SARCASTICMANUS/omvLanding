import api, { normalizeApiError } from "../../shared/lib/api";
import { OPERATIONS, TRANSPORT, TRACKING } from "../../constants";

/**
 * Fetch available routes for the driver
 */
export const getDriverRoutes = async () => {
  try {
    const response = await api.get(TRANSPORT.driverRoutes);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch driver routes.");
  }
};

/**
 * Start a trip for a specific route
 */
export const startTrip = async (routeId, vehicleId, tripScheduleId) => {
  try {
    const response = await api.post(OPERATIONS.tripsStart, {
      route_id: String(routeId),
      ...(vehicleId ? { vehicle_id: String(vehicleId) } : {}),
      ...(tripScheduleId ? { trip_schedule_id: String(tripScheduleId) } : {}),
    });
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to start trip.");
  }
};

/**
 * End an active trip
 */
export const endTrip = async (tripId) => {
  try {
    const response = await api.patch(OPERATIONS.dispatchComplete(tripId));
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to end trip.");
  }
};

/**
 * Fetch next stops and passenger manifests for an active trip
 */
export const getNextStops = async (tripId) => {
  try {
    const response = await api.get(`${OPERATIONS.trips}${tripId}/next-stops/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch next stops.");
  }
};

export const getAssignedVehicle = async () => {
  try {
    const response = await api.get(OPERATIONS.vehiclesMe);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch assigned vehicle.");
  }
};

export const getActiveTrip = async () => {
  try {
    const response = await api.get(OPERATIONS.tripsMeActive);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch active trip.");
  }
};

export const getTripBoardingRequests = async (tripId) => {
  try {
    const response = await api.get(`${OPERATIONS.trips}${tripId}/boarding-requests/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch boarding requests.");
  }
};

export const markBoarded = async (requestId) => {
  try {
    const response = await api.post(`${OPERATIONS.boardingRequests}${requestId}/boarded/`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to mark passenger boarded.");
  }
};

export const sendTelemetry = async (payload) => {
  try {
    const response = await api.post(TRACKING.ingest, payload);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to send telemetry.");
  }
};

export default {
  getDriverRoutes,
  startTrip,
  endTrip,
  getNextStops,
  getAssignedVehicle,
  getActiveTrip,
  getTripBoardingRequests,
  markBoarded,
  sendTelemetry,
};
