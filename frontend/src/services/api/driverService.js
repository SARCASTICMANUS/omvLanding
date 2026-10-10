import api from "./client";
import { API_PATHS } from "../../constants/apiPaths";

export const driverService = {
  getRoutes: () => api.get(API_PATHS.driver.routes),
  startTrip: (routeId) => api.post(API_PATHS.driver.startTrip, { route_id: routeId }),
  getTripStatus: (tripId) => api.get(API_PATHS.driver.tripStatus(tripId)),

  /**
   * Start a free-form journey: where the driver is going, not a route id.
   *
   * The server resolves the road path (mandatory) and returns it together with
   * the admin-managed global stops it passes, nearest-first. A failure to route
   * is an error here rather than a started-but-unservable journey.
   */
  startJourney: ({ vehicleId, origin, destination, originName, destinationName }) =>
    api.post(API_PATHS.tracking.journeyStart, {
      vehicle_id: vehicleId,
      origin,
      destination,
      origin_name: originName || "",
      destination_name: destinationName || "",
    }),

  endJourney: (tripId, { cancel = false } = {}) =>
    api.post(API_PATHS.tracking.journeyEnd, { trip_id: tripId, cancel }),

  /** Rehydrate a live journey after a refresh. */
  getJourney: (tripId) => api.get(API_PATHS.tracking.journey(tripId)),
};
