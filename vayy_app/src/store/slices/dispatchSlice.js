import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { OPERATIONS, TRACKING } from "../../constants";

export const requestDispatch = createAsyncThunk(
  "dispatch/request",
  async ({ route_id, pickup_stop_id, mode }, { rejectWithValue }) => {
    try {
      const response = await api.post(OPERATIONS.dispatchRequest, {
        route_id,
        pickup_stop_id,
        mode: mode || "direct",
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to request dispatch");
    }
  }
);

export const fetchActiveRouteTrips = createAsyncThunk(
  "dispatch/fetchActiveRouteTrips",
  async (routeId, { rejectWithValue }) => {
    try {
      const response = await api.get(TRACKING.activeRouteTrips(routeId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch active trips");
    }
  }
);

export const createBoardingRequest = createAsyncThunk(
  "dispatch/createBoardingRequest",
  async ({ trip, pickup_stop }, { rejectWithValue }) => {
    try {
      const response = await api.post(OPERATIONS.boardingRequests, {
        trip,
        pickup_stop,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to create boarding request");
    }
  }
);

export const cancelBoardingRequest = createAsyncThunk(
  "dispatch/cancelBoardingRequest",
  async (requestId, { rejectWithValue }) => {
    try {
      await api.delete(`${OPERATIONS.boardingRequests}${requestId}/`);
      return requestId;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to cancel boarding request");
    }
  }
);

export const cancelDispatch = createAsyncThunk(
  "dispatch/cancel",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.post(OPERATIONS.dispatchCancel(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to cancel dispatch");
    }
  }
);

export const acceptDispatch = createAsyncThunk(
  "dispatch/accept",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.patch(OPERATIONS.dispatchAccept(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to accept dispatch");
    }
  }
);

export const rejectDispatch = createAsyncThunk(
  "dispatch/reject",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.patch(OPERATIONS.dispatchReject(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to reject dispatch");
    }
  }
);

export const arrivedDispatch = createAsyncThunk(
  "dispatch/arrived",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.patch(OPERATIONS.dispatchArrived(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to mark arrived");
    }
  }
);

export const startDispatchTrip = createAsyncThunk(
  "dispatch/start",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.patch(OPERATIONS.dispatchStart(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to start trip");
    }
  }
);

export const completeDispatch = createAsyncThunk(
  "dispatch/complete",
  async (tripId, { rejectWithValue }) => {
    try {
      const response = await api.patch(OPERATIONS.dispatchComplete(tripId));
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to complete trip");
    }
  }
);

const dispatchSlice = createSlice({
  name: "dispatch",
  initialState: {
    activeDispatch: null,
    status: "idle",
    error: null,
    activeTrips: [],
    boardingRequest: null,
  },
  reducers: {
    clearDispatch: (state) => {
      state.activeDispatch = null;
      state.status = "idle";
      state.error = null;
      state.activeTrips = [];
      state.boardingRequest = null;
    },
    updateDispatchStatus: (state, action) => {
      if (state.activeDispatch) {
        state.activeDispatch = { ...state.activeDispatch, ...action.payload };
      }
    },
    setDispatchStatus: (state, action) => {
      state.status = action.payload;
    },
    setAssigned: (state, action) => {
      state.status = "assigned";
      if (action.payload) {
        state.activeDispatch = { ...state.activeDispatch, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveRouteTrips.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchActiveRouteTrips.fulfilled, (state, action) => {
        const payload = action.payload.data || action.payload;
        state.activeTrips = Array.isArray(payload) ? payload : [];
      })
      .addCase(fetchActiveRouteTrips.rejected, (state, action) => {
        state.error = action.payload;
      })
      .addCase(createBoardingRequest.pending, (state) => {
        state.status = "requesting";
        state.error = null;
      })
      .addCase(createBoardingRequest.fulfilled, (state, action) => {
        const payload = action.payload.data || action.payload;
        state.status = "requested";
        state.boardingRequest = payload;
      })
      .addCase(createBoardingRequest.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(cancelBoardingRequest.pending, (state) => {
        state.status = "cancelling";
        state.error = null;
      })
      .addCase(cancelBoardingRequest.fulfilled, (state) => {
        state.status = "cancelled";
        state.boardingRequest = null;
      })
      .addCase(cancelBoardingRequest.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(requestDispatch.pending, (state) => {
        state.status = "requesting";
        state.error = null;
      })
      .addCase(requestDispatch.fulfilled, (state, action) => {
        const payload = action.payload.data || action.payload;
        if (payload.status === "no_drivers_available") {
          state.status = "failed";
          state.error = { message: "No drivers found nearby" };
        } else {
          state.status = "requested";
          state.activeDispatch = payload;
        }
      })
      .addCase(requestDispatch.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(cancelDispatch.pending, (state) => {
        state.status = "cancelling";
        state.error = null;
      })
      .addCase(cancelDispatch.fulfilled, (state) => {
        state.status = "cancelled";
        state.activeDispatch = null;
      })
      .addCase(cancelDispatch.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(acceptDispatch.pending, (state) => {
        state.status = "accepting";
        state.error = null;
      })
      .addCase(acceptDispatch.fulfilled, (state, action) => {
        state.status = "accepted";
        state.activeDispatch = action.payload.data || action.payload;
      })
      .addCase(acceptDispatch.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(rejectDispatch.pending, (state) => {
        state.status = "rejecting";
        state.error = null;
      })
      .addCase(rejectDispatch.fulfilled, (state) => {
        state.status = "rejected";
        state.activeDispatch = null;
      })
      .addCase(rejectDispatch.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(arrivedDispatch.pending, (state) => {
        state.status = "arriving";
        state.error = null;
      })
      .addCase(arrivedDispatch.fulfilled, (state, action) => {
        state.status = "arrived";
        state.activeDispatch = action.payload.data || action.payload;
      })
      .addCase(arrivedDispatch.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(startDispatchTrip.pending, (state) => {
        state.status = "starting";
        state.error = null;
      })
      .addCase(startDispatchTrip.fulfilled, (state, action) => {
        state.status = "active";
        state.activeDispatch = action.payload.data || action.payload;
      })
      .addCase(startDispatchTrip.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(completeDispatch.pending, (state) => {
        state.status = "completing";
        state.error = null;
      })
      .addCase(completeDispatch.fulfilled, (state) => {
        state.status = "completed";
        state.activeDispatch = null;
      })
      .addCase(completeDispatch.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const { clearDispatch, updateDispatchStatus, setDispatchStatus, setAssigned } = dispatchSlice.actions;
export default dispatchSlice.reducer;
