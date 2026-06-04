import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import api, { API_URL } from "../shared/lib/api";

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

const normalizeAuthPayload = (data) => ({
  ...data,
  token: data.token || data.access,
  access: data.access || data.token,
  refresh: data.refresh,
  user: normalizeUser(data),
});

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    try {
      const response = await api.post("/api/auth/login/", {
        ...creds,
        email: creds.email?.trim().toLowerCase(),
      });
      const data = normalizeAuthPayload(response.data);

      if (data.token) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("access_token", data.token);
      }

      if (data.refresh) {
        await AsyncStorage.setItem("refresh_token", data.refresh);
      }

      await AsyncStorage.setItem("user", JSON.stringify(data.user));

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
      const response = await api.post("/api/auth/register/", {
        ...data,
        email: data.email?.trim().toLowerCase(),
      });
      const authData = normalizeAuthPayload(response.data);

      if (authData.token) {
        await AsyncStorage.setItem("token", authData.token);
        await AsyncStorage.setItem("access_token", authData.token);
      }

      if (authData.refresh) {
        await AsyncStorage.setItem("refresh_token", authData.refresh);
      }

      await AsyncStorage.setItem("user", JSON.stringify(authData.user));

      return authData;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || { error: "Registration failed" },
      );
    }
  },
);

export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (accessToken, thunkAPI) => {
    try {
      const response = await api.post("/api/dj-rest-auth/google/", {
        access_token: accessToken,
      });
      const data = normalizeAuthPayload(response.data);

      if (data.token) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("access_token", data.token);
      }

      if (data.refresh) {
        await AsyncStorage.setItem("refresh_token", data.refresh);
      }

      await AsyncStorage.setItem("user", JSON.stringify(data.user));

      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data || "Google Login Failed",
      );
    }
  },
);

export const restoreAuthFromStorage = createAsyncThunk(
  "auth/restoreFromStorage",
  async () => {
    const [token, accessToken, refreshToken, userStr] = await Promise.all([
      AsyncStorage.getItem("token"),
      AsyncStorage.getItem("access_token"),
      AsyncStorage.getItem("refresh_token"),
      AsyncStorage.getItem("user"),
    ]);
    const user = userStr ? JSON.parse(userStr) : null;

    return {
      token: token || accessToken,
      refreshToken,
      user,
    };
  },
);

const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      AsyncStorage.multiRemove(["token", "access_token", "refresh_token", "user"]);
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
    },
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
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;

        if (action.payload.token && action.payload.user) {
          state.isAuthenticated = true;
          state.token = action.payload.token;
          state.refreshToken = action.payload.refresh;
          state.user = action.payload.user;
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(googleLogin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refresh;
        state.user = action.payload.user;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.loading = false;
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
      });
  },
});

export const { logout, restoreAuth, refreshTokenSuccess } = authSlice.actions;
export default authSlice.reducer;
