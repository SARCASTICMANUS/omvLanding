export const WS = {
  cityPublic: "/ws/vayy/city_public/",
  trackingTrip: (tripId) => `/ws/tracking/trip/${tripId}/`,
  trackingVehicle: (vehicleId) => `/ws/tracking/vehicle/${vehicleId}/`,
  routePassengers: (routeId) => `/ws/tracking/route-passengers/${routeId}/`,
  dispatch: (dispatchId) => `/ws/dispatch/${dispatchId}/`,
  notifications: (userId) => `/ws/notifications/${userId}/`,
};

export default WS;
