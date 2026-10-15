// Stable handshake label exchanged with the backend. The JWT is offered as a
// second subprotocol value; the server echoes only this label back, so it is
// the one string that must never drift from WS_SUBPROTOCOL in
// backend/vayy/vayy/settings.py.
export const WS_SUBPROTOCOL = "vayy.jwt.v1";

export const WS = {
  cityPublic: "/ws/vayy/city_public/",
  trackingTrip: (tripId) => `/ws/tracking/trip/${tripId}/`,
  journeySearch: "/ws/tracking/journey-search/",
  trackingVehicle: (vehicleId) => `/ws/tracking/vehicle/${vehicleId}/`,
  routePassengers: (routeId) => `/ws/tracking/route-passengers/${routeId}/`,
  dispatch: (dispatchId) => `/ws/dispatch/${dispatchId}/`,
  dispatchBroadcast: (requestId) => `/ws/dispatch/broadcast/${requestId}/`,
  notifications: (userId) => `/ws/notifications/${userId}/`,
};

export default WS;
