import api, { normalizeApiError } from "../../shared/lib/api";
import { OPERATIONS, TRANSPORT, TRACKING } from "../../constants";

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

export const searchDriverRoutes = async (originLat, originLng, destLat, destLng, radius = 5000) => {
  try {
    const params = `origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}&radius=${radius}&role=driver`;
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

/**
 * Resolve the road and its global stops for a proposed journey.
 *
 * Creates nothing on the server, so this is safe to run on every edit of the
 * two endpoints. It is what lets the start screen show the real journey - the
 * same path and stop order `startJourney` would produce - before the driver
 * commits to it.
 */
export const previewJourney = async ({ origin, destination }) => {
  try {
    const response = await api.post(TRACKING.journeyPreview, {
      origin: { lat: Number(origin.lat), lng: Number(origin.lng ?? origin.lon) },
      destination: {
        lat: Number(destination.lat),
        lng: Number(destination.lng ?? destination.lon),
      },
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to preview this road.");
  }
};

/**
 * Start a free-form journey: where the driver is going rather than a route id.
 *
 * Both endpoints are required. The server resolves one direct road path between
 * them (mandatory — an unroutable pair is rejected rather than starting a
 * journey nothing can serve) and answers with that path plus the global stops it
 * passes, nearest-first from the origin.
 *
 * Returns `{ trip_id, path, distance_m, duration_s, origin, destination, stops }`.
 */
export const startJourney = async ({
  vehicleId,
  origin,
  destination,
  originName = "",
  destinationName = "",
}) => {
  try {
    const response = await api.post(TRACKING.journeyStart, {
      vehicle_id: String(vehicleId),
      origin: { lat: Number(origin.lat), lng: Number(origin.lng ?? origin.lon) },
      destination: {
        lat: Number(destination.lat),
        lng: Number(destination.lng ?? destination.lon),
      },
      origin_name: originName,
      destination_name: destinationName,
    });
    // Endpoints answer in { success, data }; callers want the payload.
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to start your journey.");
  }
};

/**
 * End a journey: settles boarded passengers, frees the vehicle and drops the
 * cached path. `cancel` ends it without settling.
 */
export const endJourney = async (tripId, { cancel = false } = {}) => {
  try {
    const response = await api.post(TRACKING.journeyEnd, {
      trip_id: String(tripId),
      cancel: Boolean(cancel),
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to end your journey.");
  }
};

/** Rehydrate a live journey after an app restart or refresh. */
export const getJourney = async (tripId) => {
  try {
    const response = await api.get(TRACKING.journey(tripId));
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to load your journey.");
  }
};

/**
 * The driver's in-progress journey, or null when there is none.
 *
 * Used on every app foreground to put a driver back on their journey after a
 * cold start, when the trip id was only ever in memory.
 */
export const getActiveJourney = async () => {
  try {
    const response = await api.get(TRACKING.journeyActive);
    // Note the unwrap: the usual `response.data?.data || response.data` is wrong
    // here. "No journey" is answered as `data: null`, and null is falsy, so that
    // idiom would fall through and hand back the whole { success, data: null }
    // envelope — which reads as a live journey.
    return response.data?.data ?? null;
  } catch (error) {
    throw normalizeApiError(error, "Unable to load your journey.");
  }
};

export default {
  getDriverRoutes,
  startTrip,
  getNextStops,
  getAssignedVehicle,
  searchDriverRoutes,
  getNearbyPassengers,
  startJourney,
  previewJourney,
  endJourney,
  getActiveJourney,
  getJourney,
};
