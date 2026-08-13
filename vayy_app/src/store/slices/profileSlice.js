import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { DRIVER_ROLES, AUTH } from "../../constants";

export const fetchProfile = createAsyncThunk(
  "profile/fetchProfile",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const role = auth.user?.role;

      if (DRIVER_ROLES.includes(role)) {
        const response = await api.get(AUTH.driverProfile);
        return { type: "driver", data: response.data };
      }

      const response = await api.get(AUTH.passengerProfile);
      return { type: "passenger", data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch profile");
    }
  }
);

export const updateProfile = createAsyncThunk(
  "profile/updateProfile",
  async (profileData, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const role = auth.user?.role;

      if (DRIVER_ROLES.includes(role)) {
        const response = await api.put(AUTH.driverProfile, profileData);
        return { type: "driver", data: response.data };
      }

      const response = await api.put(AUTH.passengerProfile, profileData);
      return { type: "passenger", data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to update profile");
    }
  }
);

const profileSlice = createSlice({
  name: "profile",
  initialState: {
    data: null,
    type: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearProfile: (state) => {
      state.data = null;
      state.type = null;
      state.error = null;
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
        state.data = action.payload.data;
        state.type = action.payload.type;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload.data;
        state.type = action.payload.type;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearProfile } = profileSlice.actions;
export default profileSlice.reducer;
