export const API_PATHS = {
  auth: {
    login: "/api/auth/login/",
    register: "/api/auth/register/",
    refresh: "/api/auth/refresh/",
  },
  driver: {
    routes: "/api/driver/routes/",
    startTrip: "/api/driver/start-trip/",
    tripStatus: (tripId) => `/api/driver/trip-status/${tripId}/`,
  },
  admin: {
    routePreview: "/api/admin/routes/preview/",
  },
  sockets: {
    driverManifest: (vehicleId, token) => `/ws/driver/manifest/${vehicleId}/?token=${token}`,
    trip: (tripId, token) => `/ws/trips/${tripId}/?token=${token}`,
    vehicle: (vehicleId, token) => `/ws/vehicles/${vehicleId}/?token=${token}`,
    passenger: (passengerId, token) => `/ws/passenger/${passengerId}/?token=${token}`,
  },
};

