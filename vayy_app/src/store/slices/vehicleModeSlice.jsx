import { createSlice } from "@reduxjs/toolkit";

const vehicleModeSlice = createSlice({
  name: "vehicleMode",
  initialState: {
    mode: "AUTO", // 'AUTO' or 'BIKE'
  },
  reducers: {
    setVehicleMode: (state, action) => {
      state.mode = action.payload;
    },
  },
});

export const { setVehicleMode } = vehicleModeSlice.actions;
export default vehicleModeSlice.reducer;
