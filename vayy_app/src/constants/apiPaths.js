export const AUTH = {
  login: "/api/accounts/login/",
  register: "/api/accounts/register/",
  sendRegistrationOtp: "/api/accounts/send-registration-otp/",
  verifyAndRegister: "/api/accounts/verify-and-register/",
  resendRegistrationOtp: "/api/accounts/resend-registration-otp/",
  completeRegistration: "/api/accounts/complete-registration/",
  verifyOtp: "/api/accounts/verify-otp/",
  resendOtp: "/api/accounts/resend-otp/",
  forgotPassword: "/api/accounts/forgot-password/",
  tokenRefresh: "/api/accounts/token/refresh/",
  recentSearches: "/api/accounts/recent-searches/",
  driverProfile: "/api/accounts/me/driver-profile/",
  passengerProfile: "/api/accounts/me/passenger-profile/",
  wallet: "/api/accounts/wallet/",
  walletAddFunds: "/api/accounts/wallet/add-funds/",
  pushToken: "/api/accounts/push-token/",
  driverDocuments: "/api/accounts/driver/documents/",
  driverDocumentDetail: (id) => `/api/accounts/driver/documents/${id}/`,
  driverBankDetails: "/api/accounts/driver/bank-details/",
  verificationStatus: "/api/accounts/verification-status/",
};

export const OPERATIONS = {
  trips: "/api/operations/trips/",
  tripDetail: (id) => `/api/operations/trips/${id}/`,
  tripsStart: "/api/operations/trips/start/",
  vehicles: "/api/operations/vehicles/",
  vehiclesMe: "/api/operations/vehicles/me/",
  vehicleRegister: "/api/operations/vehicles/register/",
  dispatchRequest: "/api/operations/dispatch/request/",
  dispatchComplete: (id) => `/api/operations/dispatch/${id}/complete/`,
  dispatchAccept: (id) => `/api/operations/dispatch/${id}/accept/`,
  dispatchReject: (id) => `/api/operations/dispatch/${id}/reject/`,
  dispatchArrived: (id) => `/api/operations/dispatch/${id}/arrived/`,
  dispatchStart: (id) => `/api/operations/dispatch/${id}/start/`,
  dispatchCancel: (id) => `/api/operations/dispatch/${id}/cancel/`,
  broadcastAccept: (requestId) => `/api/operations/dispatch/broadcast/${requestId}/accept/`,
  broadcastReject: (requestId) => `/api/operations/dispatch/broadcast/${requestId}/reject/`,
  broadcastCancel: (requestId) => `/api/operations/dispatch/broadcast/${requestId}/cancel/`,
  boardingRequests: "/api/operations/boarding-requests/",
  boardingRequestBoarded: (id) => `/api/operations/boarding-requests/${id}/boarded/`,
};

export const TRANSPORT = {
  routes: "/api/transport/routes/",
  routesPreview: "/api/transport/routes/preview/",
  routesSearchByLocation: "/api/transport/routes/search-by-location/",
  routesNearbyPassengers: (routeId) => `/api/transport/routes/${routeId}/nearby-passengers/`,
  driverRoutes: "/api/transport/driver/routes/",
  // Admin-created boarding points that belong to no route. These are what a
  // driver journey is matched against and what a passenger raises a hand at.
  cities: "/api/transport/cities/",
  roadDistance: "/api/transport/road-distance/",
  walkingPath: "/api/transport/walking-path/",
};

export const RIDE = {
  estimate: "/api/ride/estimate/",
  history: "/api/ride/history/",
  rating: "/api/ride/rating/",
  tripFare: (id) => `/api/ride/trip/${id}/fare/`,
};

export const TRACKING = {
  passengerLocation: "/api/tracking/passenger-location/",
  nearbyVehicles: "/api/tracking/nearby/",
  activeRouteTrips: (routeId) => `/api/tracking/route/${routeId}/active-trips/`,
  // ── Journeys: free-form driver trips, no fixed route ──
  journeyStart: "/api/tracking/journeys/start/",
  // Resolves the road and its stops without starting anything, so the driver
  // can see the actual journey before committing. Safe to call on every edit.
  journeyPreview: "/api/tracking/journeys/preview/",
  journeyEnd: "/api/tracking/journeys/end/",
  // The driver's in-progress journey, or null. Lets a cold start put the driver
  // back on their journey without the app knowing the trip id.
  journeyActive: "/api/tracking/journeys/active/",
  journey: (id) => `/api/tracking/journeys/${id}/`,
  // ── Passenger hand raise ──
  // route_id is optional: omitting it makes this journey-scoped, so the request
  // goes to the drivers whose journeys pass the pickup stop.
  raiseHand: "/api/tracking/raise-hand/",
  // Live vehicles running the corridor between two searched points. Read-only:
  // returns the resolved road, its stops, and the vehicles serving them.
  corridorVehicles: "/api/tracking/corridor/vehicles/",
};

export const COMMUNICATION = {
  notifications: "/api/communication/notifications/",
};

export const ADMIN = {
  routes: "/api/transport/admin/routes/",
  stops: "/api/transport/admin/stops/",
  driversPending: "/api/operations/admin/drivers/pending/",
  driverVerify: (id) => `/api/operations/admin/drivers/${id}/verify/`,
  users: "/api/accounts/users/",
  passengerProfile: (userId) => `/api/accounts/me/passenger-profile/?user_id=${userId}`,
  driverProfile: (userId) => `/api/accounts/me/driver-profile/?user_id=${userId}`,
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
