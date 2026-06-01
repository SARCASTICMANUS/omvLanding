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

export const updateUser = createAsyncThunk(
  "profile/updateUser",
  async ({ id, data }, thunkAPI) => {
    try {
      const response = await api.patch(`/api/users/${id}/`, data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to update user data" }
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
        if (state.data) {
          state.data.profile = action.payload;
          // Sync phone number in parent user object if present
          if (action.payload.phone_number) {
            state.data.phone_number = action.payload.phone_number;
          }
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
        if (state.data) {
          state.data.profile = action.payload;
          if (action.payload.phone_number) {
            state.data.phone_number = action.payload.phone_number;
          }
        }
      })
      .addCase(updateDriverProfile.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      })
      .addCase(updateUser.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.updateLoading = false;
        // Deep merge: keep existing profile if the response doesn't have a better one
        const updatedUser = action.payload;
        const currentProfile = state.data?.profile;
        
        state.data = { 
          ...state.data, 
          ...updatedUser,
          profile: updatedUser.profile || currentProfile 
        };
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload;
      });
  },
});

export const { clearProfileError } = profileSlice.actions;
export default profileSlice.reducer;
