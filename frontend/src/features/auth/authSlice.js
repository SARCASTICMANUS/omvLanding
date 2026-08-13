import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";

const getPersistedUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
};

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    try {
      const response = await api.post(API_PATHS.auth.login, creds);
      const data = response.data;
      const tokens = data.tokens || data;

      const userData = {
        role: data.role,
        name: data.name,
        email: data.email,
        city: data.city,
      };

      localStorage.setItem("access_token", tokens.access);
      localStorage.setItem("refresh_token", tokens.refresh);
      localStorage.setItem("user", JSON.stringify(userData));

      return { ...data, tokens, user: userData };
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
      const response = await api.post(API_PATHS.auth.register, data);
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
    token: localStorage.getItem("access_token"),
    refreshToken: localStorage.getItem("refresh_token"),
    isAuthenticated: !!localStorage.getItem("access_token") && !!getPersistedUser(),
    loading: false,
    error: null,
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
        state.token = action.payload.tokens.access;
        state.refreshToken = action.payload.tokens.refresh;
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
        const tokens = action.payload.tokens || action.payload;
        if (tokens.access && action.payload.user) {
          state.isAuthenticated = true;
          state.token = tokens.access;
          state.refreshToken = tokens.refresh;
          state.user = action.payload.user;
          localStorage.setItem("access_token", tokens.access);
          localStorage.setItem("refresh_token", tokens.refresh);
          localStorage.setItem("user", JSON.stringify(action.payload.user));
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
  },
});

export const { logout, restoreAuth, refreshTokenSuccess } = authSlice.actions;
export default authSlice.reducer;
