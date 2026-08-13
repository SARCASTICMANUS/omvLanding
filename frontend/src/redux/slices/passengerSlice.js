import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  profile: null,
  activeTripId: null,
  selectedStopId: null,
  nearbyStops: [],
  notifications: [],
  loading: false,
  error: null,
};

const passengerSlice = createSlice({
  name: "passenger",
  initialState,
  reducers: {
    setPassengerProfile: (state, action) => {
      state.profile = action.payload;
    },
    setPassengerActiveTrip: (state, action) => {
      state.activeTripId = action.payload;
    },
    setSelectedStop: (state, action) => {
      state.selectedStopId = action.payload;
    },
    setNearbyStops: (state, action) => {
      state.nearbyStops = action.payload || [];
    },
    pushPassengerNotification: (state, action) => {
      state.notifications.unshift({
        id: action.payload?.id || `${Date.now()}`,
        createdAt: Date.now(),
        ...action.payload,
      });
    },
    clearPassengerNotifications: (state) => {
      state.notifications = [];
    },
    setPassengerLoading: (state, action) => {
      state.loading = action.payload;
    },
    setPassengerError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const {
  setPassengerProfile,
  setPassengerActiveTrip,
  setSelectedStop,
  setNearbyStops,
  pushPassengerNotification,
  clearPassengerNotifications,
  setPassengerLoading,
  setPassengerError,
} = passengerSlice.actions;

export default passengerSlice.reducer;

