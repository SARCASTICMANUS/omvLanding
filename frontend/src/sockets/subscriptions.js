import { API_PATHS } from "../constants/apiPaths";

export const socketKeys = {
  driverManifest: (vehicleId) => `driver-manifest:${vehicleId}`,
  trip: (tripId) => `trip:${tripId}`,
  vehicle: (vehicleId) => `vehicle:${vehicleId}`,
  passenger: (passengerId) => `passenger:${passengerId}`,
};

export const createSocketPath = {
  driverManifest: (vehicleId) => API_PATHS.sockets.driverManifest(vehicleId, localStorage.getItem("access_token")),
  trip: (tripId) => API_PATHS.sockets.trip(tripId, localStorage.getItem("access_token")),
  vehicle: (vehicleId) => API_PATHS.sockets.vehicle(vehicleId, localStorage.getItem("access_token")),
  passenger: (passengerId) => API_PATHS.sockets.passenger(passengerId, localStorage.getItem("access_token")),
};

