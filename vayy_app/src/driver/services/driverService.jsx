import api, { normalizeApiError } from "../../shared/lib/api";
import { dynamicPreview } from "../../routes/services/routeService";
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

// Backend-generated routes mapped onto the existing driver route-card props.
// Returns an array (callers already accept a bare array). `radius` is kept only
// for call-site compat; the legacy search-by-location is empty on this backend.
export const searchDriverRoutes = async (
  originLat,
  originLng,
  destLat,
  destLng,
  _radius = 5000,
  options = {}
) => {
  const { routes } = await dynamicPreview({
    origin: { lat: originLat, lng: originLng },
    destination: { lat: destLat, lng: destLng },
    vehicleType: options.vehicleType || "bike",
    audience: "driver",
  });
  return routes;
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