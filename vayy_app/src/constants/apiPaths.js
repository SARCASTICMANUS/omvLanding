export const AUTH = {
  login: "/api/accounts/login/",
  register: "/api/accounts/register/",
  verifyOtp: "/api/accounts/verify-otp/",
  resendOtp: "/api/accounts/resend-otp/",
  forgotPassword: "/api/accounts/forgot-password/",
  tokenRefresh: "/api/accounts/token/refresh/",
  recentSearches: "/api/accounts/recent-searches/",
  driverProfile: "/api/accounts/me/driver-profile/",
  passengerProfile: "/api/accounts/me/passenger-profile/",
  wallet: "/api/accounts/wallet/",
  walletAddFunds: "/api/accounts/wallet/add-funds/",
};

export const OPERATIONS = {
  trips: "/api/operations/trips/",
  tripsStart: "/api/operations/trips/start/",
  tripsMeActive: "/api/operations/trips/me/active/",
  vehicles: "/api/operations/vehicles/",
  vehiclesMe: "/api/operations/vehicles/me/",
  dispatchRequest: "/api/operations/dispatch/request/",
  dispatchComplete: (id) => `/api/operations/dispatch/${id}/complete/`,
  dispatchAccept: (id) => `/api/operations/dispatch/${id}/accept/`,
  dispatchReject: (id) => `/api/operations/dispatch/${id}/reject/`,
  dispatchArrived: (id) => `/api/operations/dispatch/${id}/arrived/`,
  dispatchStart: (id) => `/api/operations/dispatch/${id}/start/`,
  dispatchCancel: (id) => `/api/operations/dispatch/${id}/cancel/`,
  boardingRequests: "/api/operations/boarding-requests/",
  boardingRequestBoarded: (id) => `/api/operations/boarding-requests/${id}/boarded/`,
};

export const TRANSPORT = {
  routes: "/api/transport/routes/",
  routesPreview: "/api/transport/routes/preview/",
  routesSearchByLocation: "/api/transport/routes/search-by-location/",
  routesNearbyPassengers: (routeId) => `/api/transport/routes/${routeId}/nearby-passengers/`,
  driverRoutes: "/api/transport/driver/routes/",
  stopsNearby: "/api/transport/stops/nearby/",
  cities: "/api/transport/cities/",
};

export const RIDE = {
  estimate: "/api/ride/estimate/",
  history: "/api/ride/history/",
  rating: "/api/ride/rating/",
  earnings: "/api/ride/earnings/",
};

export const TRACKING = {
  ingest: "/api/tracking/ingest/",
  passengerLocation: "/api/tracking/passenger-location/",
  nearbyVehicles: "/api/tracking/nearby/",
  activeRouteTrips: (routeId) => `/api/tracking/route/${routeId}/active-trips/`,
};

export const COMMUNICATION = {
  notifications: "/api/communication/notifications/",
};

export const ADMIN = {
  routes: "/api/admin/routes/",
  stops: "/api/admin/stops/",
};

const API_PATHS = {
  AUTH,
  OPERATIONS,
  TRANSPORT,
  RIDE,
  TRACKING,
  COMMUNICATION,
  ADMIN,
};

export default API_PATHS;
