import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { RIDE } from "../../constants";

export const fetchRideHistory = createAsyncThunk(
  "ride/fetchHistory",
  async ({ status, page } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (status) params.status = status;
      if (page) params.page = page;
      const response = await api.get(RIDE.history, { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch ride history");
    }
  }
);

export const submitRating = createAsyncThunk(
  "ride/submitRating",
  async ({ trip, rating, review }, { rejectWithValue }) => {
    try {
      const response = await api.post(RIDE.rating, { trip, rating, review });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to submit rating");
    }
  }
);

export const getRideEstimate = createAsyncThunk(
  "ride/getEstimate",
  async ({ pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type }, { rejectWithValue }) => {
    try {
      const response = await api.post(RIDE.estimate, {
        pickup_lat, pickup_lng, drop_lat, drop_lng, vehicle_type,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to get estimate");
    }
  }
);

export const fetchDriverEarnings = createAsyncThunk(
  "ride/fetchEarnings",
  async ({ period } = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (period) params.period = period;
      const response = await api.get(RIDE.earnings, { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch earnings");
    }
  }
);

const rideSlice = createSlice({
  name: "ride",
  initialState: {
    history: [],
    historyCount: 0,
    historyLoading: false,
    historyError: null,
    ratingLoading: false,
    estimate: null,
    estimateLoading: false,
    earnings: null,
    earningsLoading: false,
    earningsError: null,
  },
  reducers: {
    clearEstimate: (state) => {
      state.estimate = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRideHistory.pending, (state) => {
        state.historyLoading = true;
        state.historyError = null;
      })
      .addCase(fetchRideHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.history = action.payload.results || action.payload.data || [];
        state.historyCount = action.payload.count || 0;
      })
      .addCase(fetchRideHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.historyError = action.payload;
      })
      .addCase(submitRating.pending, (state) => {
        state.ratingLoading = true;
      })
      .addCase(submitRating.fulfilled, (state) => {
        state.ratingLoading = false;
      })
      .addCase(submitRating.rejected, (state) => {
        state.ratingLoading = false;
      })
      .addCase(getRideEstimate.pending, (state) => {
        state.estimateLoading = true;
      })
      .addCase(getRideEstimate.fulfilled, (state, action) => {
        state.estimateLoading = false;
        state.estimate = action.payload.data || action.payload;
      })
      .addCase(getRideEstimate.rejected, (state) => {
        state.estimateLoading = false;
      })
      .addCase(fetchDriverEarnings.pending, (state) => {
        state.earningsLoading = true;
        state.earningsError = null;
      })
      .addCase(fetchDriverEarnings.fulfilled, (state, action) => {
        state.earningsLoading = false;
        state.earnings = action.payload.data || action.payload;
      })
      .addCase(fetchDriverEarnings.rejected, (state, action) => {
        state.earningsLoading = false;
        state.earningsError = action.payload;
      });
  },
});

export const { clearEstimate } = rideSlice.actions;
export default rideSlice.reducer;
