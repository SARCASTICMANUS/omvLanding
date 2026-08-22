import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  matchStatus: "idle",
  distanceToStop: 0,
  isWithinRange: false,
  raiseHandStatus: "idle",
  rideStatus: "idle",
  trip: null,
  pickup: null,
  destination: null,
};

const rideFlowSlice = createSlice({
  name: "rideFlow",
  initialState,
  reducers: {
    setTrip: (state, action) => {
      state.trip = action.payload.trip;
      state.pickup = action.payload.pickup;
      state.destination = action.payload.destination;
    },
    setDistanceToStop: (state, action) => {
      state.distanceToStop = action.payload;
      state.isWithinRange = action.payload <= 500;
    },
    setMatchStatus: (state, action) => {
      state.matchStatus = action.payload;
    },
    setRaiseHandStatus: (state, action) => {
      state.raiseHandStatus = action.payload;
    },
    setRideStatus: (state, action) => {
      state.rideStatus = action.payload;
    },
    resetRideFlow: () => initialState,
  },
});

export const {
  setTrip,
  setDistanceToStop,
  setMatchStatus,
  setRaiseHandStatus,
  setRideStatus,
  resetRideFlow,
} = rideFlowSlice.actions;

export default rideFlowSlice.reducer;
