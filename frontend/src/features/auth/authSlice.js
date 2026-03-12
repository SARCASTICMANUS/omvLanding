import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../utils/api";

// Helper to safely parse JSON from localStorage
const getPersistedUser = () => {
  try {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};

const token = localStorage.getItem("token");
const persistedUser = getPersistedUser();

export const loginUser = createAsyncThunk(
  "auth/login",
  async (creds, thunkAPI) => {
    try {
      const response = await api.post("/api/auth/login/", creds);

      const userData = {
        role: response.data.role,
        name: response.data.name,
        email: response.data.email,
        university: response.data.university,
      };

      localStorage.setItem("token", response.data.access);
      localStorage.setItem("user", JSON.stringify(userData));
      console.log("login response", response.data);

      return { ...response.data, user: userData };
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
      return thunkAPI.rejectWithValue(error.response?.data);
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    // 2. Initialize state from LocalStorage
    user: persistedUser,
    token: token,
    isAuthenticated: !!token && !!persistedUser,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      // 3. Clear LocalStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
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
        state.token = action.payload.access;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
