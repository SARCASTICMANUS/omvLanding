import { createSlice } from "@reduxjs/toolkit";

const DEFAULT_STATE = {
  currentStep: "planner",
  assignedRouteIds: [],
  activeTrip: null,
  activeRide: null,
  selectedRoute: null,
  source: null,
  destination: null,
  status: "idle",
  loading: false,
  error: null,
};

const loadDriverContext = () => {
  try {
    const serialized = localStorage.getItem("VAYY_DRIVER_CONTEXT");
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    // Older builds persisted review/preflight steps; selected routes now
    // continue through the mobile-style Pre-Ride Check screen.
    const currentStep = ["review", "preflight"].includes(parsed.currentStep)
      ? parsed.selectedRoute
        ? "preflight"
        : "planner"
      : parsed.currentStep;
    // Ensure loading is false on boot and keys added later exist on
    // contexts persisted by older builds.
    return {
      ...DEFAULT_STATE,
      ...parsed,
      currentStep,
      activeRide: parsed.activeRide ?? null,
      loading: false,
    };
  } catch {
    return null;
  }
};

const driverSlice = createSlice({
  name: "driver",
  initialState: loadDriverContext() || DEFAULT_STATE,
  reducers: {
    setStep: (state, action) => {
      state.currentStep = action.payload;
      localStorage.setItem("VAYY_DRIVER_CONTEXT", JSON.stringify(state));
    },
    setDriverActiveTrip: (state, action) => {
      state.activeTrip = action.payload;
      state.status = action.payload ? "active" : "idle";
      state.currentStep = action.payload ? "live" : "planner";
      localStorage.setItem("VAYY_DRIVER_CONTEXT", JSON.stringify(state));
    },
    setActiveRide: (state, action) => {
      state.activeRide = action.payload;
      state.status = action.payload ? "assigned" : "idle";
      localStorage.setItem("VAYY_DRIVER_CONTEXT", JSON.stringify(state));
    },
    setSelectedRoute: (state, action) => {
      state.selectedRoute = action.payload;
      localStorage.setItem("VAYY_DRIVER_CONTEXT", JSON.stringify(state));
    },
    setSearchQuery: (state, action) => {
      state.source = action.payload.source;
      state.destination = action.payload.destination;
      localStorage.setItem("VAYY_DRIVER_CONTEXT", JSON.stringify(state));
    },
    setDriverLoading: (state, action) => {
      state.loading = action.payload;
    },
    setDriverError: (state, action) => {
      state.error = action.payload;
    },
    setDriverStatus: (state, action) => {
      state.status = action.payload;
    },
    setAssignedRoutes: (state, action) => {
      state.assignedRouteIds = action.payload;
      localStorage.setItem("VAYY_DRIVER_CONTEXT", JSON.stringify(state));
    },
    resetDriverState: () => {
      localStorage.removeItem("VAYY_DRIVER_CONTEXT");
      return DEFAULT_STATE;
    },
  },
});

export const {
  setStep,
  setDriverActiveTrip,
  setActiveRide,
  setSelectedRoute,
  setSearchQuery,
  resetDriverState,
  setDriverLoading,
  setDriverStatus,
  setAssignedRoutes,
  setDriverError,
} = driverSlice.actions;

export default driverSlice.reducer;
