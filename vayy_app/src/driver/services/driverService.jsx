import api, { normalizeApiError } from "../../shared/lib/api";
import { OPERATIONS, TRANSPORT } from "../../constants";

export const getDriverRoutes = async () => {
  try {
    const response = await api.get(TRANSPORT.driverRoutes);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch driver routes.");
  }
};

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

export const searchDriverRoutes = async (originLat, originLng, destLat, destLng, radius = 1000) => {
  try {
    const params = `origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}&radius=${radius}`;
    const response = await api.get(`${TRANSPORT.routesSearchByLocation}?${params}`);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to search routes by location.");
  }
};

export const getNearbyPassengers = async (routeId) => {
  try {
    const response = await api.get(TRANSPORT.routesNearbyPassengers(routeId));
    return response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to fetch nearby passengers.");
  }
};

export default {
  getDriverRoutes,
  startTrip,
  getNextStops,
  getAssignedVehicle,
  searchDriverRoutes,
  getNearbyPassengers,
};