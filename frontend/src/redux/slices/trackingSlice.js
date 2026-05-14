import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeTripId: null,
  vehicleId: null,
  currentPosition: null,
  previousPosition: null,
  speedKmh: 0,
  etaSeconds: null,
  routeProgress: 0,
  lastUpdatedAt: null,
  status: "idle",
};

const trackingSlice = createSlice({
  name: "tracking",
  initialState,
  reducers: {
    startTracking: (state, action) => {
      state.activeTripId = action.payload?.tripId || null;
      state.vehicleId = action.payload?.vehicleId || null;
      state.status = "live";
      state.lastUpdatedAt = Date.now();
    },
    updateTrackingSnapshot: (state, action) => {
      state.previousPosition = state.currentPosition;
      state.currentPosition = action.payload?.position || state.currentPosition;
      state.speedKmh = action.payload?.speedKmh ?? state.speedKmh;
      state.etaSeconds = action.payload?.etaSeconds ?? state.etaSeconds;
      state.routeProgress = action.payload?.routeProgress ?? state.routeProgress;
      state.lastUpdatedAt = action.payload?.timestamp || Date.now();
      state.status = "live";
    },
    pauseTracking: (state) => {
      state.status = "paused";
    },
    resetTracking: () => initialState,
  },
});

export const {
  startTracking,
  updateTrackingSnapshot,
  pauseTracking,
  resetTracking,
} = trackingSlice.actions;

export default trackingSlice.reducer;

