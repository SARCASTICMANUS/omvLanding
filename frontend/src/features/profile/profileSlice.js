import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../lib/api";

export const fetchProfile = createAsyncThunk(
  "profile/fetchProfile",
  async (_, thunkAPI) => {
    try {
      const response = await api.get("/api/auth/me/");
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to fetch profile" }
      );
    }
  }
);

export const updatePassengerProfile = createAsyncThunk(
  "profile/updatePassengerProfile",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await api.patch(`/api/passenger-profiles/${id}/`, data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to update profile" }
      );
    }
  }
);

export const updateDriverProfile = createAsyncThunk(
  "profile/updateDriverProfile",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await api.patch(`/api/driver-profiles/${id}/`, data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to update profile" }
      );
    }
  }
);

const profileSlice = createSlice({
  name: "profile",
  initialState: {
    data: null,
    loading: false,
    error: null,
    updateLoading: false,
    updateError: null,
  },
  reducers: {
    clearProfileError: (state) => {
      state.error = null;
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updatePassengerProfile.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updatePassengerProfile.fulfilled, (state, action) => {
        state.updateLoading = false;
        if (state.data && state.data.role === "passenger") {
          state.data.profile = action.payload;
        }
      })
      .addCase(updatePassengerProfile.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      })
      .addCase(updateDriverProfile.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateDriverProfile.fulfilled, (state, action) => {
        state.updateLoading = false;
        if (state.data && state.data.role === "driver") {
          state.data.profile = action.payload;
        }
      })
      .addCase(updateDriverProfile.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      });
  },
});

export const { clearProfileError } = profileSlice.actions;
export default profileSlice.reducer;
