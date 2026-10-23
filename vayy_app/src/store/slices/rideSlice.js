import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { RIDE } from "../../constants";

const unwrap = (payload) => payload?.data ?? payload;

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

const rideSlice = createSlice({
  name: "ride",
  initialState: {
    history: [],
    historyCount: 0,
    historyLoading: false,
    historyError: null,
    ratingLoading: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRideHistory.pending, (state) => {
        state.historyLoading = true;
        state.historyError = null;
        state.history = [];
        state.historyCount = 0;
      })
      .addCase(fetchRideHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        const data = unwrap(action.payload);
        const results = data?.results || (Array.isArray(data) ? data : []);
        state.history = results.filter((trip) =>
          trip?.status === "completed" && Number(trip.earnings ?? trip.total_fare ?? trip.fare) > 0
        );
        state.historyCount = state.history.length;
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
      });
  },
});

export default rideSlice.reducer;
