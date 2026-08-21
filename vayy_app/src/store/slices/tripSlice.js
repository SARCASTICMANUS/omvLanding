import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { OPERATIONS } from "../../constants";

const unwrap = (payload) => payload?.data ?? payload;

export const fetchVehicles = createAsyncThunk(
  "trip/fetchVehicles",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get(OPERATIONS.vehicles);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch vehicles");
    }
  }
);

export const startTrip = createAsyncThunk(
  "trip/startTrip",
  async ({ routeId, vehicleId, tripScheduleId }, { rejectWithValue }) => {
    try {
      const response = await api.post(OPERATIONS.tripsStart, {
        route_id: String(routeId),
        vehicle_id: String(vehicleId),
        trip_schedule_id: tripScheduleId ? String(tripScheduleId) : undefined,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to start trip");
    }
  }
);

export const endTrip = createAsyncThunk(
  "trip/endTrip",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.patch(OPERATIONS.dispatchComplete(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to end trip");
    }
  }
);

export const createBoardingRequest = createAsyncThunk(
  "trip/createBoardingRequest",
  async ({ tripId, stopId }, { rejectWithValue }) => {
    try {
      const response = await api.post(OPERATIONS.boardingRequests, {
        trip: tripId,
        pickup_stop: stopId,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to create boarding request");
    }
  }
);

export const markBoarded = createAsyncThunk(
  "trip/markBoarded",
  async (requestId, { rejectWithValue }) => {
    try {
      const response = await api.post(OPERATIONS.boardingRequestBoarded(requestId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to mark as boarded");
    }
  }
);

const tripSlice = createSlice({
  name: "trip",
  initialState: {
    activeTrip: null,
    status: "idle",
    vehicles: [],
    vehiclesLoading: false,
    boardingStatus: "idle",
    error: null,
    manifest: [],
  },
  reducers: {
    updateManifest: (state, action) => {
      state.manifest = action.payload;
    },
    resetTripState: (state) => {
      state.activeTrip = null;
      state.status = "idle";
      state.error = null;
      state.manifest = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVehicles.pending, (state) => {
        state.vehiclesLoading = true;
      })
      .addCase(fetchVehicles.fulfilled, (state, action) => {
        state.vehiclesLoading = false;
        const data = unwrap(action.payload);
        state.vehicles = Array.isArray(data) ? data : [];
      })
      .addCase(fetchVehicles.rejected, (state, action) => {
        state.vehiclesLoading = false;
        state.error = action.payload;
      })
      .addCase(startTrip.pending, (state) => {
        state.status = "loading";
      })
      .addCase(startTrip.fulfilled, (state, action) => {
        state.status = "active";
        state.activeTrip = unwrap(action.payload);
        state.error = null;
      })
      .addCase(startTrip.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload;
      })
      .addCase(endTrip.fulfilled, (state) => {
        state.status = "idle";
        state.activeTrip = null;
      })
      .addCase(createBoardingRequest.pending, (state) => {
        state.boardingStatus = "requesting";
      })
      .addCase(createBoardingRequest.fulfilled, (state) => {
        state.boardingStatus = "requested";
      })
      .addCase(createBoardingRequest.rejected, (state) => {
        state.boardingStatus = "error";
      });
  },
});

export const { updateManifest, resetTripState } = tripSlice.actions;
export default tripSlice.reducer;
