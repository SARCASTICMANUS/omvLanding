import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

const liveBusAdapter = createEntityAdapter({
  selectId: (bus) => bus.vehicleId || bus.id,
});

const initialState = liveBusAdapter.getInitialState({
  activeVehicleId: null,
  lastSyncedAt: null,
});

const liveBusSlice = createSlice({
  name: "liveBus",
  initialState,
  reducers: {
    setLiveBuses: (state, action) => {
      liveBusAdapter.setAll(state, action.payload || []);
      state.lastSyncedAt = Date.now();
    },
    upsertLiveBus: (state, action) => {
      liveBusAdapter.upsertOne(state, action.payload);
      state.lastSyncedAt = Date.now();
    },
    removeLiveBus: liveBusAdapter.removeOne,
    setActiveVehicle: (state, action) => {
      state.activeVehicleId = action.payload;
    },
    clearLiveBuses: (state) => {
      liveBusAdapter.removeAll(state);
      state.activeVehicleId = null;
      state.lastSyncedAt = null;
    },
  },
});

export const {
  setLiveBuses,
  upsertLiveBus,
  removeLiveBus,
  setActiveVehicle,
  clearLiveBuses,
} = liveBusSlice.actions;

export const liveBusSelectors = liveBusAdapter.getSelectors((state) => state.liveBus);
export default liveBusSlice.reducer;

