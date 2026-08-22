import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  currentPosition: null,
  routePolyline: [],
  remainingDistance: 0,
  remainingEta: 0,
  nextStop: null,
  status: "idle",
  endValidation: "none",
};

const autoRideSlice = createSlice({
  name: "autoRide",
  initialState,
  reducers: {
    setCurrentPosition: (state, action) => {
      state.currentPosition = action.payload;
    },
    setRoutePolyline: (state, action) => {
      state.routePolyline = action.payload;
    },
    setRideProgress: (state, action) => {
      state.remainingDistance = action.payload.remainingDistance;
      state.remainingEta = action.payload.remainingEta;
      state.nextStop = action.payload.nextStop;
    },
    setRideStatus: (state, action) => {
      state.status = action.payload;
    },
    setEndValidation: (state, action) => {
      state.endValidation = action.payload;
    },
    resetRide: () => initialState,
  },
});

export const {
  setCurrentPosition,
  setRoutePolyline,
  setRideProgress,
  setRideStatus,
  setEndValidation,
  resetRide,
} = autoRideSlice.actions;

export default autoRideSlice.reducer;
