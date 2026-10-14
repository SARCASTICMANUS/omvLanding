import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";

// constants/apiPaths.js is shared/off-limits, so the registration OTP routes that
// only mobile declares live here (backend: accounts/api/urls.py).
const REGISTRATION_PATHS = {
  sendRegistrationOtp: "/api/accounts/send-registration-otp/",
  verifyAndRegister: "/api/accounts/verify-and-register/",
  resendRegistrationOtp: "/api/accounts/resend-registration-otp/",
};

const getPersistedUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

// Backend wraps every payload in { success, message, data } (common/responses.py).
const unwrapPayload = (payload) =>
  payload && typeof payload === "object" && "data" in payload
    ? payload.data
    : payload;

// Mobile parity: vayy_app/src/auth/authSlice.jsx normalizeUser()
const normalizeUser = (payload = {}) => {
  const source =
    payload.user && typeof payload.user === "object" ? payload.user : payload;
  const firstName = source.first_name || "";
  const lastName = source.last_name || "";
  const name =
    source.name ||
    source.full_name ||
    [firstName, lastName].filter(Boolean).join(" ");

  return {
    id: source.id,
    role: source.role || payload.role,
    name,
    first_name: firstName,
    last_name: lastName,
    email: source.email || payload.email,
    city: source.city ?? payload.city ?? null,
  };
};

const normalizeError = (error) => {
  // Axios network failure (server down / wrong base URL / CORS blocked the
  // response) has no `response` — surface it distinctly from auth failures.
  if (error?.request && !error?.response) {
    return {
      error: "Cannot reach the server. Please make sure the OMV API is running and try again.",
    };
  }
  return (
    error.response?.data || { error: "Something went wrong. Please try again." }
  );
};

const persistSession = (tokens, user) => {
  if (tokens?.access) localStorage.setItem("access_token", tokens.access);
  if (tokens?.refresh) localStorage.setItem("refresh_token", tokens.refresh);
  if (user) localStorage.setItem("user", JSON.stringify(user));
};

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    try {
      const email = String(creds?.email || "").trim().toLowerCase();
      const response = await api.post(API_PATHS.auth.login, {
        email,
        password: creds.password,
      });

      const payload = unwrapPayload(response.data) || {};
      const tokens = payload.tokens || {};
      const user = normalizeUser(payload);

      persistSession(tokens, user);

      return { ...payload, tokens, user };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

// Passenger registration — POST /api/accounts/register/ (creates user + emails Safety Code)
export const registerUser = createAsyncThunk(
  "auth/register",
  async (data, thunkAPI) => {
    try {
      const response = await api.post(API_PATHS.auth.register, {
        email: String(data.email || "").trim().toLowerCase(),
        password: data.password,
        role: data.role,
        first_name: data.first_name || "",
        last_name: data.last_name || "",
      });

      const payload = unwrapPayload(response.data) || {};
      const user = normalizeUser(payload);

      return { user, email: user.email || data.email };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

// Driver registration — stashes the payload in Redis, no user is created yet
export const sendRegistrationOtp = createAsyncThunk(
  "auth/sendRegistrationOtp",
  async (data, thunkAPI) => {
    try {
      await api.post(REGISTRATION_PATHS.sendRegistrationOtp, {
        email: String(data.email || "").trim().toLowerCase(),
        password: data.password,
        role: data.role,
        first_name: data.first_name || "",
      });

      return { email: String(data.email || "").trim().toLowerCase() };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

export const verifyAndRegister = createAsyncThunk(
  "auth/verifyAndRegister",
  async ({ email, otp }, thunkAPI) => {
    try {
      const response = await api.post(REGISTRATION_PATHS.verifyAndRegister, {
        email: String(email || "").trim().toLowerCase(),
        otp,
      });

      const payload = unwrapPayload(response.data) || {};
      const user = normalizeUser(payload);

      return { user, email: user.email || email };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

export const resendRegistrationOtp = createAsyncThunk(
  "auth/resendRegistrationOtp",
  async (email, thunkAPI) => {
    try {
      await api.post(REGISTRATION_PATHS.resendRegistrationOtp, {
        email: String(email || "").trim().toLowerCase(),
      });

      return { email: String(email || "").trim().toLowerCase() };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async ({ email, otp }, thunkAPI) => {
    try {
      const response = await api.post(API_PATHS.auth.verifyOtp, {
        email: String(email || "").trim().toLowerCase(),
        otp,
      });

      const payload = unwrapPayload(response.data) || {};
      const user = normalizeUser(payload);
      // Sign the user in. verify-otp is the ONLY endpoint that mints a session
      // for the passenger signup flow (register deliberately issues no token),
      // and this thunk was throwing those tokens away - so after confirming the
      // Safety Code the user still had no access_token and every later call
      // (Edit Profile, trips, wallet) came back 401. `loginUser` above does
      // exactly this; verifyOtp just never did.
      const tokens = payload.tokens || payload;
      persistSession(tokens, user);

      return { user, email };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

export const resendOtp = createAsyncThunk(
  "auth/resendOtp",
  async (email, thunkAPI) => {
    try {
      await api.post(API_PATHS.auth.resendOtp, {
        email: String(email || "").trim().toLowerCase(),
      });

      return { email: String(email || "").trim().toLowerCase() };
    } catch (error) {
      return thunkAPI.rejectWithValue(normalizeError(error));
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: getPersistedUser(),
    token: localStorage.getItem("access_token"),
    refreshToken: localStorage.getItem("refresh_token"),
    isAuthenticated:
      !!localStorage.getItem("access_token") && !!getPersistedUser(),
    loading: false,
    error: null,
    isOtpSent: false,
    otpEmail: null,
  },
  reducers: {
    logout: (state) => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isOtpSent = false;
      state.otpEmail = null;
    },
    restoreAuth: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
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
        state.error = null;
        state.isAuthenticated = true;
        state.isOtpSent = false;
        state.otpEmail = null;
        state.token = action.payload.tokens?.access || null;
        state.refreshToken = action.payload.tokens?.refresh || null;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Registration / OTP thunks deliberately do NOT touch the shared
      // `loading` / `error` pair — those belong to the login screen so a
      // failed sign-up never leaks a stale error into the login form.
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isOtpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(sendRegistrationOtp.fulfilled, (state, action) => {
        state.isOtpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(resendRegistrationOtp.fulfilled, (state, action) => {
        state.isOtpSent = true;
        state.otpEmail = action.payload.email;
      })
      .addCase(verifyAndRegister.fulfilled, (state) => {
        state.isOtpSent = false;
        state.otpEmail = null;
      })
      .addCase(verifyOtp.fulfilled, (state) => {
        state.isOtpSent = false;
        state.otpEmail = null;
      });
  },
});

export const { logout, restoreAuth, refreshTokenSuccess, clearOtpSent } =
  authSlice.actions;
export default authSlice.reducer;
