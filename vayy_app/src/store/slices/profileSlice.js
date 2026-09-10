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
        return { type: "driver", data: response.data?.data || response.data };
      }

      const response = await api.get(AUTH.passengerProfile);
      return { type: "passenger", data: response.data?.data || response.data };
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
        return { type: "driver", data: response.data?.data || response.data };
      }

      const response = await api.put(AUTH.passengerProfile, profileData);
      return { type: "passenger", data: response.data?.data || response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to update profile");
    }
  }
);

export const fetchVerificationStatus = createAsyncThunk(
  "profile/fetchVerificationStatus",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get(AUTH.verificationStatus);
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch verification status");
    }
  }
);

export const uploadDocument = createAsyncThunk(
  "profile/uploadDocument",
  async ({ documentType, fileUri, fileName }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("document_type", documentType);
      formData.append("file", {
        uri: fileUri,
        name: fileName || fileUri.split("/").pop(),
        type: "image/jpeg",
      });
      const response = await api.post(AUTH.driverDocuments, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data?.data || response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to upload document");
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
    verification: null,
    verificationLoading: false,
  },
  reducers: {
    clearProfile: (state) => {
      state.data = null;
      state.type = null;
      state.error = null;
      state.verification = null;
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
      })
      .addCase(fetchVerificationStatus.pending, (state) => {
        state.verificationLoading = true;
      })
      .addCase(fetchVerificationStatus.fulfilled, (state, action) => {
        state.verificationLoading = false;
        state.verification = action.payload;
      })
      .addCase(fetchVerificationStatus.rejected, (state) => {
        state.verificationLoading = false;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        if (state.verification?.documents) {
          state.verification.documents.push(action.payload);
        }
      });
  },
});

export const { clearProfile } = profileSlice.actions;
export default profileSlice.reducer;
