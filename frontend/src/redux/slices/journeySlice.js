import { createSlice } from "@reduxjs/toolkit";

const DEFAULT_STATE = {
  currentStep: "planner",
  pickup: null,
  destination: null,
  filteredTrips: [],
  selectedTrip: null,
  loading: false,
  error: null,
};

const loadJourneyContext = () => {
  try {
    const serialized = localStorage.getItem("VAYY_JOURNEY_CONTEXT");
    if (!serialized) return null;
    const parsed = JSON.parse(serialized);
    // Reset loading on initialization
    return { ...parsed, loading: false };
  } catch (e) {
    console.warn("Failed to load journey context", e);
    return null;
  }
};

const journeySlice = createSlice({
  name: "journey",
  initialState: loadJourneyContext() || DEFAULT_STATE,
  reducers: {
    setJourneyStep: (state, action) => {
      state.currentStep = action.payload;
      localStorage.setItem("VAYY_JOURNEY_CONTEXT", JSON.stringify(state));
    },
    setJourneyPoints: (state, action) => {
      state.pickup = action.payload.pickup;
      state.destination = action.payload.destination;
      state.selectedTrip = null;
      state.filteredTrips = [];
      localStorage.setItem("VAYY_JOURNEY_CONTEXT", JSON.stringify(state));
    },
    setFilteredTrips: (state, action) => {
      state.filteredTrips = action.payload || [];
      localStorage.setItem("VAYY_JOURNEY_CONTEXT", JSON.stringify(state));
    },
    setSelectedTrip: (state, action) => {
      state.selectedTrip = action.payload;
      localStorage.setItem("VAYY_JOURNEY_CONTEXT", JSON.stringify(state));
    },
    setPickupPoint: (state, action) => {
      state.pickup = action.payload;
      state.selectedTrip = null;
      localStorage.setItem("VAYY_JOURNEY_CONTEXT", JSON.stringify(state));
    },
    setDestinationPoint: (state, action) => {
      state.destination = action.payload;
      state.selectedTrip = null;
      localStorage.setItem("VAYY_JOURNEY_CONTEXT", JSON.stringify(state));
    },
    setJourneyLoading: (state, action) => {
      state.loading = action.payload;
    },
    setJourneyError: (state, action) => {
      state.error = action.payload;
    },
    resetJourneyState: () => {
      localStorage.removeItem("VAYY_JOURNEY_CONTEXT");
      return DEFAULT_STATE;
    },
  },
});

export const {
  setJourneyStep,
  setJourneyPoints,
  setFilteredTrips,
  setSelectedTrip,
  setPickupPoint,
  setDestinationPoint,
  setJourneyLoading,
  setJourneyError,
  resetJourneyState,
} = journeySlice.actions;

export default journeySlice.reducer;
