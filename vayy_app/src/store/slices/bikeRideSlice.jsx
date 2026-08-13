import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  raiseHandStatus: "idle",
  matchStatus: "idle",
  matchedRider: null,
  arrivalStatus: "idle",
  distanceToStop: 0,
  riderLocation: null,
  otpStatus: "pending",
  otpAttempts: 0,
  maxOtpAttempts: 3,
  otpVerified: false,
  rideStatus: "not_started",
  rideStartedAt: null,
  rideEndedAt: null,
  currentLocation: null,
  routePolyline: null,
  remainingDistance: 0,
  remainingEta: 0,
  speed: 0,
  endValidation: null,
  trip: null,
  pickup: null,
  destination: null,
};

const bikeRideSlice = createSlice({
  name: "bikeRide",
  initialState,
  reducers: {
    setRaiseHandStatus: (state, action) => {
      state.raiseHandStatus = action.payload;
    },
    setMatchStatus: (state, action) => {
      state.matchStatus = action.payload;
    },
    setMatchedRider: (state, action) => {
      state.matchedRider = action.payload;
      state.matchStatus = "found";
    },
    setArrivalStatus: (state, action) => {
      state.arrivalStatus = action.payload.status;
      state.distanceToStop = action.payload.distance ?? state.distanceToStop;
    },
    setRiderLocation: (state, action) => {
      state.riderLocation = action.payload;
    },
    updateRiderProximity: (state, action) => {
      state.distanceToStop = action.payload;
      if (action.payload <= 100 && state.arrivalStatus !== "arrived") {
        state.arrivalStatus = "proximity";
      }
      if (action.payload <= 10) {
        state.arrivalStatus = "arrived";
      }
    },
    setOtpStatus: (state, action) => {
      state.otpStatus = action.payload;
      if (action.payload === "failed") {
        state.otpAttempts += 1;
      }
      if (action.payload === "verified") {
        state.otpVerified = true;
      }
    },
    incrementOtpAttempt: (state) => {
      state.otpAttempts += 1;
    },
    setRideStatus: (state, action) => {
      state.rideStatus = action.payload;
      if (action.payload === "active") {
        state.rideStartedAt = new Date().toISOString();
      }
      if (action.payload === "ended") {
        state.rideEndedAt = new Date().toISOString();
      }
    },
    setCurrentLocation: (state, action) => {
      state.currentLocation = action.payload;
    },
    setRoutePolyline: (state, action) => {
      state.routePolyline = action.payload;
    },
    setTrackingData: (state, action) => {
      state.remainingDistance = action.payload.distance ?? state.remainingDistance;
      state.remainingEta = action.payload.eta ?? state.remainingEta;
      state.speed = action.payload.speed ?? state.speed;
    },
    setEndValidation: (state, action) => {
      state.endValidation = action.payload;
    },
    clearEndValidation: (state) => {
      state.endValidation = null;
    },
    setTrip: (state, action) => {
      state.trip = action.payload.trip;
      state.pickup = action.payload.pickup;
      state.destination = action.payload.destination;
    },
    resetBikeRide: () => initialState,
  },
});

export const {
  setRaiseHandStatus,
  setMatchStatus,
  setMatchedRider,
  setArrivalStatus,
  setRiderLocation,
  updateRiderProximity,
  setOtpStatus,
  incrementOtpAttempt,
  setRideStatus,
  setCurrentLocation,
  setRoutePolyline,
  setTrackingData,
  setEndValidation,
  clearEndValidation,
  setTrip,
  resetBikeRide,
} = bikeRideSlice.actions;

export default bikeRideSlice.reducer;
