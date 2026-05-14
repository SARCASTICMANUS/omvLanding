import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  assignedRouteIds: [],
  activeTrip: null,
  manifest: null,
  nextStops: [],
  passengersById: {},
  status: "idle",
  loading: false,
  error: null,
};

const driverSlice = createSlice({
  name: "driver",
  initialState,
  reducers: {
    setAssignedRoutes: (state, action) => {
      state.assignedRouteIds = action.payload || [];
    },
    setDriverActiveTrip: (state, action) => {
      state.activeTrip = action.payload;
      state.status = action.payload ? "active" : "idle";
    },
    setDriverManifest: (state, action) => {
      state.manifest = action.payload;
    },
    setDriverNextStops: (state, action) => {
      state.nextStops = action.payload || [];
    },
    setDriverPassengers: (state, action) => {
      state.passengersById = action.payload || {};
    },
    upsertDriverPassenger: (state, action) => {
      const passenger = action.payload;
      if (!passenger?.id) return;
      state.passengersById[passenger.id] = passenger;
    },
    setDriverStatus: (state, action) => {
      state.status = action.payload;
    },
    setDriverLoading: (state, action) => {
      state.loading = action.payload;
    },
    setDriverError: (state, action) => {
      state.error = action.payload;
    },
    resetDriverState: () => initialState,
  },
});

export const {
  setAssignedRoutes,
  setDriverActiveTrip,
  setDriverManifest,
  setDriverNextStops,
  setDriverPassengers,
  upsertDriverPassenger,
  setDriverStatus,
  setDriverLoading,
  setDriverError,
  resetDriverState,
} = driverSlice.actions;

export default driverSlice.reducer;

