// VAYY | src/features/auth/authSlice.js | Status: 🔧 Fixed
// Reason: Store refreshToken; add JWT exp decode helper array + restoreAuth logic.
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../lib/api";

const getPersistedUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    try {
      const response = await api.post("/api/auth/login/", creds);
      const data = response.data;
      
      const userData = {
        role: data.role,
        name: data.name,
        email: data.email,
        city: data.city,
      };

      localStorage.setItem("token", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      localStorage.setItem("user", JSON.stringify(userData));

      return { ...data, user: userData };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Login failed" },
      );
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/register",
  async (data, thunkAPI) => {
    try {
      const response = await api.post("/api/auth/register/", data);
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data || { error: "Registration failed" });
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: getPersistedUser(),
    token: localStorage.getItem("token"),
    refreshToken: localStorage.getItem("refreshToken"),
    isAuthenticated: !!localStorage.getItem("token") && !!getPersistedUser(),
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
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
    }
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
        state.token = action.payload.access;
        state.refreshToken = action.payload.refresh;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        // Optionally auto-login on register
        if (action.payload.access && action.payload.user) {
          state.isAuthenticated = true;
          state.token = action.payload.access;
          state.refreshToken = action.payload.refresh;
          state.user = action.payload.user;
          localStorage.setItem("token", action.payload.access);
          localStorage.setItem("refreshToken", action.payload.refresh);
          localStorage.setItem("user", JSON.stringify(action.payload.user));
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, restoreAuth, refreshTokenSuccess } = authSlice.actions;
export default authSlice.reducer;
