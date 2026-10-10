import api from "./client";
import { API_PATHS } from "../../constants/apiPaths";

/**
 * Passenger-side calls for the journey flow.
 *
 * A passenger stands at an admin-created global stop, sees which vehicles are
 * passing it, and raises a hand. `raiseHand` omits `routeId` deliberately: the
 * server treats a request without a route as journey-scoped and offers it to the
 * drivers whose journeys serve that stop.
 */
export const journeyPassengerService = {
  /** Admin-created stops within walking distance (1 km server-side). */
  nearbyGlobalStops: (lat, lng, radius) =>
    api.get(API_PATHS.transport.globalStopsNearby, { params: { lat, lng, radius } }),

  /** Vehicles whose current journey serves a stop. */
  passingVehicles: (stopId) => api.get(API_PATHS.tracking.stopPassingVehicles(stopId)),

  /** Raise a hand at a stop. Returns the broadcast request id to listen on. */
  raiseHand: ({ pickupStopId, dropStopId, lat, lng }) =>
    api.post(API_PATHS.tracking.raiseHand, {
      pickup_stop_id: pickupStopId,
      dropoff_stop_id: dropStopId || undefined,
      lat,
      lng,
    }),
};
