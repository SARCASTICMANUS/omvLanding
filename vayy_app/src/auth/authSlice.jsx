import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import api, { API_URL } from "../shared/lib/api";
import { AUTH, STORAGE_KEYS } from "../constants";

const normalizeUser = (data) => {
  if (data.user) {
    return data.user;
  }

  return {
    id: data.id,
    role: data.role,
    full_name: data.full_name || data.name,
    name: data.name || data.full_name,
    email: data.email,
    city: data.city,
  };
};

const normalizeAuthPayload = (data) => {
  const token = data.token || data.access || data.tokens?.access;
  const refresh = data.refresh || data.tokens?.refresh;
  return {
    ...data,
    token,
    access: token,
    refresh,
    user: normalizeUser(data),
  };
};

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    try {
      const response = await api.post(AUTH.login, {
        email: creds.email?.trim().toLowerCase(),
        password: creds.password,
      });

      const payload = response.data.data || response.data;
      const data = normalizeAuthPayload(payload);

      if (data.token) {
        await AsyncStorage.setItem(STORAGE_KEYS.token, data.token);
        await AsyncStorage.setItem(STORAGE_KEYS.accessToken, data.token);
      }

      if (data.refresh) {
        await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));

      return data;
    } catch (error) {
      const data = error.response?.data;
      if (typeof data === "string" && data.includes("<!DOCTYPE html>")) {
        return thunkAPI.rejectWithValue({
          error: `Backend returned HTML instead of JSON. Check your URL. Current BaseURL: ${API_URL}`,
        });
      }
      return thunkAPI.rejectWithValue(
        data || { error: "Login failed" },
      );
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (data, thunkAPI) => {
    try {
      const response = await api.post(AUTH.register, {
        email: data.email?.trim().toLowerCase(),
        password: data.password,
        role: data.role,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
      });

      const payload = response.data.data || response.data;
      const user = normalizeUser(payload);

      await AsyncStorage.setItem(STORAGE_KEYS.pendingEmail, user.email);

      return { user, email: user.email };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Registration failed" },
      );
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, otp }, thunkAPI) => {
    try {
      const response = await api.post(AUTH.verifyOtp, {
        email: email?.trim().toLowerCase(),
        otp,
      });

      const payload = response.data.data || response.data;
      const user = normalizeUser(payload);

      return { user, email };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Safety Code verification failed" },
      );
    }
  },
);

export const resendOtp = createAsyncThunk(
  "auth/resendOtp",
  async (email, thunkAPI) => {
    try {
      await api.post(AUTH.resendOtp, {
        email: email?.trim().toLowerCase(),
      });
      return { email };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to resend Safety Code" },
      );
    }
  },
);

export const restoreAuthFromStorage = createAsyncThunk(
  "auth/restoreFromStorage",
  async () => {
    const [token, accessToken, refreshToken, userStr] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.accessToken),
      AsyncStorage.getItem(STORAGE_KEYS.refreshToken),
      AsyncStorage.getItem(STORAGE_KEYS.user),
    ]);
    const user = userStr ? JSON.parse(userStr) : null;

    return {
      token: token || accessToken,
      refreshToken,
      user,
    };
  },
);

export const logout = createAsyncThunk(
  "auth/logout",
  async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.token,
      STORAGE_KEYS.accessToken,
      STORAGE_KEYS.refreshToken,
      STORAGE_KEYS.user,
      STORAGE_KEYS.pendingEmail,
    ]);
  },
);

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  isOtpSent: false,
  otpEmail: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    restoreAuth: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = !!action.payload.token && !!action.payload.user;
    },
    refreshTokenSuccess: (state, action) => {
      state.token = action.payload.token;

      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
      }
    },
    clearOtpSent: (state) => {
      state.isOtpSent = false;
      state.otpEmail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.isOtpSent = false;
        state.otpEmail = null;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refresh;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isOtpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(verifyOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state) => {
        state.loading = false;
        state.isOtpSent = false;
        state.otpEmail = null;
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(resendOtp.pending, (state) => {
        state.error = null;
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(restoreAuthFromStorage.pending, (state) => {
        state.loading = true;
      })
      .addCase(restoreAuthFromStorage.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
        state.isAuthenticated = !!action.payload.token && !!action.payload.user;
      })
      .addCase(restoreAuthFromStorage.rejected, (state) => {
        state.loading = false;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.isOtpSent = false;
        state.otpEmail = null;
      });
  },
});

export const { restoreAuth, refreshTokenSuccess, clearOtpSent } = authSlice.actions;
export default authSlice.reducer;