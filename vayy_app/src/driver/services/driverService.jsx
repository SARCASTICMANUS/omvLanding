import api, { normalizeApiError } from "../../shared/lib/api";
import { dynamicPreview } from "../../routes/services/routeService";
import { OPERATIONS, TRANSPORT, TRACKING } from "../../constants";


export const previewJourney = async ({ origin, destination }) => {
  try {
    const response = await api.post(TRACKING.journeyPreview, { origin, destination });
    return response.data?.data ?? response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to preview this journey.");
  }
};

export const startJourney = async ({ vehicleId, origin, destination, originName, destinationName }) => {
  try {
    const response = await api.post(TRACKING.journeyStart, {
      vehicle_id: String(vehicleId), origin, destination,
      origin_name: originName || "", destination_name: destinationName || "",
    });
    return response.data?.data ?? response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to start this journey.");
  }
};

export const getActiveJourney = async () => {
  try {
    const response = await api.get(TRACKING.journeyActive);
    return response.data?.data ?? null;
  } catch (error) {
    throw normalizeApiError(error, "Unable to restore your active journey.");
  }
};

export const getJourney = async (tripId) => {
  try {
    const response = await api.get(TRACKING.journeyDetail(tripId));
    return response.data?.data ?? response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to load this journey.");
  }
};

export const endJourney = async (tripId, { cancel = false } = {}) => {
  try {
    const response = await api.post(TRACKING.journeyEnd, { trip_id: String(tripId), cancel });
    return response.data?.data ?? response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to end this journey.");
  }
};

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
  const preview = await dynamicPreview({
    origin: { lat: originLat, lng: originLng },
    destination: { lat: destLat, lng: destLng },
    vehicleType: options.vehicleType || "bike",
    audience: "driver",
  });
  if (!preview.routes.length) {
    throw new Error(preview.emptyMessage || "No route could be built between these locations. Check that the city has usable global stops.");
  }
  return preview.routes;
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
  previewJourney,
  startJourney,
  getActiveJourney,
  getJourney,
  endJourney,
  getDriverRoutes,
  startTrip,
  getNextStops,
  getAssignedVehicle,
  searchDriverRoutes,
  getNearbyPassengers,
};
