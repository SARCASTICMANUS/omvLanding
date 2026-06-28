import { createSlice } from "@reduxjs/toolkit";

const trackingSlice = createSlice({
  name: "tracking",
  initialState: {
    vehicles: {}, // keyed by vehicle_id or trip_id
    cityId: null,
  },
  reducers: {
    updateVehicle: (state, action) => {
      const { id, vehicle_id, trip_id, lat, lon, eta, h, d } = action.payload;
      const vehicleId = id || vehicle_id || trip_id;
      
      if (!vehicleId || lat === undefined || lon === undefined) {
        if (__DEV__) console.warn("[TrackingSlice] Received invalid update:", action.payload);
        return;
      }

      state.vehicles[vehicleId] = {
        ...state.vehicles[vehicleId],
        lat: Number(lat),
        lon: Number(lon),
        eta: eta !== undefined ? Number(eta) : state.vehicles[vehicleId]?.eta,
        heading: h !== undefined ? Number(h) : state.vehicles[vehicleId]?.heading,
        delay: d !== undefined ? Number(d) : state.vehicles[vehicleId]?.delay,
        lastUpdate: Date.now(),
      };
    },
    removeVehicle: (state, action) => {
      delete state.vehicles[action.payload];
    },
    setCityId: (state, action) => {
      state.cityId = action.payload;
      state.vehicles = {}; // Clear vehicles when city changes
    },
    clearTracking: (state) => {
      state.vehicles = {};
    },
  },
});

export const { updateVehicle, removeVehicle, setCityId, clearTracking } = trackingSlice.actions;
export default trackingSlice.reducer;
