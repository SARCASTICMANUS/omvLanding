import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  fetchRoutesAPI,
  createRouteAPI,
} from "./services/adminRouteService";
import {
  fetchStopsAPI,
  createStopAPI,
} from "./services/adminStopService";

// 🔹 ROUTES
export const fetchRoutes = createAsyncThunk(
  "admin/fetchRoutes",
  async (_, thunkAPI) => {
    try {
      return await fetchRoutesAPI();
    } catch (err) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

export const createRoute = createAsyncThunk(
  "admin/createRoute",
  async (data, thunkAPI) => {
    try {
      return await createRouteAPI(data);
    } catch (err) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

// 🔹 STOPS
export const fetchStops = createAsyncThunk(
  "admin/fetchStops",
  async (_, thunkAPI) => {
    try {
      return await fetchStopsAPI();
    } catch (err) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

export const createStop = createAsyncThunk(
  "admin/createStop",
  async (data, thunkAPI) => {
    try {
      return await createStopAPI(data);
    } catch (err) {
      return thunkAPI.rejectWithValue(err.message);
    }
  }
);

const adminSlice = createSlice({
  name: "admin",
  initialState: {
    routes: [],
    stops: [],
    loading: false,
    error: null,
  },
  reducers: {},

  extraReducers: (builder) => {
    builder
      // ROUTES
      .addCase(fetchRoutes.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchRoutes.fulfilled, (state, action) => {
        state.loading = false;
        state.routes = action.payload;
      })
      .addCase(fetchRoutes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createRoute.fulfilled, (state, action) => {
        state.routes.push(action.payload);
      })

      // STOPS
      .addCase(fetchStops.fulfilled, (state, action) => {
        state.stops = action.payload;
      })

      .addCase(createStop.fulfilled, (state, action) => {
        state.stops.push(action.payload);
      });
  },
});

export default adminSlice.reducer;