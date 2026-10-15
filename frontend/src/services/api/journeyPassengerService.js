import api from "./client";
import { API_PATHS } from "../../constants/apiPaths";

/** Passenger calls for live, route-compatible driver journeys. */
export const journeyPassengerService = {
  nearbyGlobalStops: (lat, lng, radius) =>
    api.get(API_PATHS.transport.globalStopsNearby, { params: { lat, lng, radius } }),

  /** Resolve both passenger endpoints against active driver OSRM paths. */
  searchCorridorVehicles: ({ origin, destination, radius, limit } = {}) =>
    api.post(API_PATHS.tracking.corridorVehicles, {
      origin,
      destination,
      ...(radius ? { radius } : {}),
      ...(limit ? { limit } : {}),
    }),

  passingVehicles: (stopId) =>
    api.get(API_PATHS.tracking.stopPassingVehicles(stopId)),

  /** Existing global-stop hand-raise contract, retained for compatible clients. */
  raiseHand: ({ pickupStopId, dropStopId, lat, lng }) =>
    api.post(API_PATHS.tracking.raiseHand, {
      pickup_stop_id: pickupStopId,
      dropoff_stop_id: dropStopId || undefined,
      lat,
      lng,
    }),
};
