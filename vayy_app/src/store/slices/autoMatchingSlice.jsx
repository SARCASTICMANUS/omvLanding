import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  approachingAutos: [],
  assignedAuto: null,
  matchingStatus: "idle",
};

const autoMatchingSlice = createSlice({
  name: "autoMatching",
  initialState,
  reducers: {
    setApproachingAutos: (state, action) => {
      state.approachingAutos = action.payload;
      if (action.payload.length > 0) {
        state.matchingStatus = "autos_found";
      }
    },
    addApproachingAuto: (state, action) => {
      const existing = state.approachingAutos.findIndex(
        (a) => a.autoId === action.payload.autoId
      );
      if (existing >= 0) {
        state.approachingAutos[existing] = action.payload;
      } else {
        state.approachingAutos.push(action.payload);
      }
    },
    removeApproachingAuto: (state, action) => {
      state.approachingAutos = state.approachingAutos.filter(
        (a) => a.autoId !== action.payload
      );
      if (state.approachingAutos.length === 0) {
        state.matchingStatus = "searching";
      }
    },
    setAssignedAuto: (state, action) => {
      state.assignedAuto = action.payload;
      state.matchingStatus = "auto_assigned";
    },
    setMatchingStatus: (state, action) => {
      state.matchingStatus = action.payload;
    },
    resetMatching: () => initialState,
  },
});

export const {
  setApproachingAutos,
  addApproachingAuto,
  removeApproachingAuto,
  setAssignedAuto,
  setMatchingStatus,
  resetMatching,
} = autoMatchingSlice.actions;

export default autoMatchingSlice.reducer;
