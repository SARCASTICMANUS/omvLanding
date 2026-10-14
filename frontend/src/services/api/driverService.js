import api from "./client";
import { API_PATHS } from "../../constants/apiPaths";

export const driverService = {
  getRoutes: () => api.get(API_PATHS.driver.routes),
  startTrip: (routeId) => api.post(API_PATHS.driver.startTrip, { route_id: routeId }),
  getTripStatus: (tripId) => api.get(API_PATHS.driver.tripStatus(tripId)),
};

