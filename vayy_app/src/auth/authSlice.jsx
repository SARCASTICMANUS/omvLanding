import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import api, { API_URL, setAccessTokenCache, clearAccessTokenCache } from "../shared/lib/api";
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

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    const email = creds.email?.trim().toLowerCase();
    console.log("[Auth] loginUser:", email);
    try {
      const response = await api.post(AUTH.login, {
        email,
        password: creds.password,
      });

      const payload = response.data.data || response.data;
      const data = normalizeAuthPayload(payload);
      console.log("[Auth] loginUser success: user role=", data.user?.role, "hasToken=", !!data.token);

      // persistSession() call-sites = verify-otp + login ONLY.
      // Do NOT persist tokens on a "pending" login (401 email_not_verified).
      // The pending case is handled by the caller showing the OTP screen prefilled.
      if (data.token && data.refresh) {
        await AsyncStorage.setItem(STORAGE_KEYS.token, data.token);
        await AsyncStorage.setItem(STORAGE_KEYS.accessToken, data.token);
        await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh);
        // Keep api.jsx's in-memory token in step (T4): the request interceptor
        // reads from memory first and would otherwise keep sending the old one.
        setAccessTokenCache(data.token);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));

      return data;
    } catch (error) {
      const data = error.response?.data;
      console.error("[Auth] loginUser error:", {
        status: error.response?.status ?? null,
        data: data ?? null,
        message: error.message,
        code: error.code,
        baseURL: error.config?.baseURL || API_URL,
        path: error.config?.url || AUTH.login,
      });
      if (typeof data === "string" && data.includes("<!DOCTYPE html>")) {
        return thunkAPI.rejectWithValue({
          error: `Backend returned HTML instead of JSON. Check your URL. Current BaseURL: ${API_URL}`,
        });
      }
      if (!error.response) {
        return thunkAPI.rejectWithValue({
          error: `Could not reach the OMV backend at ${error.config?.baseURL || API_URL}. Check that the backend is running and the app is using a host-reachable API URL. Request error: ${error.message || error.code || "network error"}.`,
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

      return { user, email: user.email };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Registration failed" },
      );
    }
  },
);

export const sendRegistrationOtp = createAsyncThunk(
  "auth/sendRegistrationOtp",
  async (data, thunkAPI) => {
    const payload = {
      email: data.email?.trim().toLowerCase(),
      password: data.password,
      role: data.role,
      first_name: data.first_name || "",
    };
    console.log("[Auth] sendRegistrationOtp payload:", JSON.stringify({ ...payload, password: "***" }));
    try {
      const response = await api.post(AUTH.sendRegistrationOtp, payload);
      console.log("[Auth] sendRegistrationOtp success:", response.data);
      return { email: data.email?.trim().toLowerCase() };
    } catch (error) {
      console.error("[Auth] sendRegistrationOtp error:", error.response?.status, error.response?.data);
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to send Safety Code" },
      );
    }
  },
);

export const verifyAndRegister = createAsyncThunk(
  "auth/verifyAndRegister",
  async ({ email, otp }, thunkAPI) => {
    const payload = { email: email?.trim().toLowerCase(), otp };
    console.log("[Auth] verifyAndRegister payload:", JSON.stringify(payload));
    try {
      const response = await api.post(AUTH.verifyAndRegister, payload);
      console.log("[Auth] verifyAndRegister success:", response.data);
      const data = response.data.data || response.data;
      const user = normalizeUser(data);
      return { user, email: user.email };
    } catch (error) {
      console.error("[Auth] verifyAndRegister error:", error.response?.status, error.response?.data);
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Verification failed" },
      );
    }
  },
);

export const resendRegistrationOtp = createAsyncThunk(
  "auth/resendRegistrationOtp",
  async (email, thunkAPI) => {
    const payload = { email: email?.trim().toLowerCase() };
    console.log("[Auth] resendRegistrationOtp payload:", JSON.stringify(payload));
    try {
      const response = await api.post(AUTH.resendRegistrationOtp, payload);
      console.log("[Auth] resendRegistrationOtp success:", response.data);
      return { email };
    } catch (error) {
      console.error("[Auth] resendRegistrationOtp error:", error.response?.status, error.response?.data);
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Failed to resend Safety Code" },
      );
    }
  },
);

export const completeRegistration = createAsyncThunk(
  "auth/completeRegistration",
  async (data, thunkAPI) => {
    const payload = {
      role: data.role || "",
      display_name: data.display_name || "",
      phone_number: data.phone_number || "",
      dob: data.dob || null,
      gender: data.gender || "",
      vehicle_type: data.vehicle_type,
      vehicle_number: data.vehicle_number,
      vehicle_photo: data.vehicle_photo || "",
      rc_number: data.rc_number || "",
      document_ids: data.document_ids || [],
      bank_details: data.bank_details || {},
    };
    console.log("[Auth] completeRegistration payload:", JSON.stringify(payload));
    try {
      const response = await api.post(AUTH.completeRegistration, payload);
      console.log("[Auth] completeRegistration success:", response.data);
      const result = response.data.data || response.data;
      return result;
    } catch (error) {
      console.error("[Auth] completeRegistration error:", error.response?.status, error.response?.data);
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Driver registration failed" },
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

      // persistSession() call-site: verify-otp saves tokens.
      await AsyncStorage.setItem(STORAGE_KEYS.token, payload.token || payload.access || "");
      await AsyncStorage.setItem(STORAGE_KEYS.accessToken, payload.token || payload.access || "");
      await AsyncStorage.setItem(STORAGE_KEYS.refreshToken, payload.refresh || "");
      setAccessTokenCache(payload.token || payload.access || "");

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
    // The in-memory access token must die with the stored ones, otherwise the
    // next signed-out request would still carry the old Authorization header.
    clearAccessTokenCache();
    // Also clear profile slice cache so the UI forgets the old profile
    // (dispatch is available in thunks via the thunkAPI)
    // We dispatch via the root reducer; the profile slice will be cleared
    // on the next app rehydration.
  },
);

export const refreshTokenThunk = createAsyncThunk(
  "auth/refreshTokenThunk",
  async () => {
    const res = await api.post(AUTH.tokenRefresh, { refresh: await AsyncStorage.getItem(STORAGE_KEYS.refreshToken) });
    return res.data.data || res.data;
  },
);

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

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
        state.user = action.payload.user;
        state.token = action.payload.token || action.payload.access || null;
        state.refreshToken = action.payload.refresh || action.payload.refreshToken || null;
        state.isAuthenticated = Boolean(state.token && state.user);
        state.isOtpSent = false;
        state.otpEmail = null;
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
      .addCase(sendRegistrationOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendRegistrationOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.isOtpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(sendRegistrationOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(verifyAndRegister.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyAndRegister.fulfilled, (state) => {
        state.loading = false;
        state.isOtpSent = false;
        state.otpEmail = null;
      })
      .addCase(verifyAndRegister.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(resendRegistrationOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resendRegistrationOtp.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(resendRegistrationOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(completeRegistration.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(completeRegistration.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(completeRegistration.rejected, (state, action) => {
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
        // tokens already persisted inside verifyOtp thunk
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
      })
      // Refresh token cycle
      .addCase(refreshTokenThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.access || action.payload.token;
        if (action.payload.refresh) {
          state.refreshToken = action.payload.refresh;
        }
      })
      .addCase(refreshTokenThunk.rejected, (state, action) => {
        // Clear stale tokens on refresh failure → force re-login
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        state.isAuthenticated = false;
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { restoreAuth, refreshTokenSuccess, clearOtpSent } = authSlice.actions;
export default authSlice.reducer;