import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  startJourney as startJourneyRequest,
  endJourney as endJourneyRequest,
  getJourney as getJourneyRequest,
  previewJourney as previewJourneyRequest,
  getActiveJourney as getActiveJourneyRequest,
} from "../../driver/services/driverService";
import { searchCorridorVehicles } from "../../passenger/services/passengerService";

const unwrap = (payload) => payload?.data ?? payload;

/**
 * A driver's live journey: where they declared they are going, the road path
 * the server resolved for it, and the admin-managed global stops it passes.
 *
 * One journey serves many passengers, so `stops` is the list of boarding
 * points on the way — not a per-ride manifest.
 */

export const startJourney = createAsyncThunk(
  "journey/start",
  async ({ vehicleId, origin, destination, originName, destinationName }, { rejectWithValue }) => {
    try {
      return await startJourneyRequest({
        vehicleId,
        origin,
        destination,
        originName,
        destinationName,
      });
    } catch (error) {
      return rejectWithValue(error.message || "Could not start your journey");
    }
  }
);

export const endJourney = createAsyncThunk(
  "journey/end",
  async ({ tripId, cancel = false }, { rejectWithValue }) => {
    try {
      return await endJourneyRequest(tripId, { cancel });
    } catch (error) {
      return rejectWithValue(error.message || "Could not end your journey");
    }
  }
);

export const fetchJourney = createAsyncThunk(
  "journey/fetch",
  async (tripId, { rejectWithValue }) => {
    try {
      return await getJourneyRequest(tripId);
    } catch (error) {
      return rejectWithValue(error.message || "Could not load your journey");
    }
  }
);

/**
 * Look for a journey that is already running for this driver.
 *
 * Run on app start and on every return to the foreground. Resolves to `null`
 * rather than rejecting when there is nothing to resume, because "no journey" is
 * the normal case and must not surface as an error.
 */
export const fetchActiveJourney = createAsyncThunk(
  "journey/fetchActive",
  async (_, { rejectWithValue }) => {
    try {
      return await getActiveJourneyRequest();
    } catch (error) {
      return rejectWithValue(error.message || "Could not load your journey");
    }
  }
);

/**
 * Resolve the road and its stops for a journey the driver has not started yet.
 *
 * Held separately from `activeJourney` on purpose: previewing must never look
 * like a live trip, so it cannot overwrite the state the live screen reads.
 */
export const previewJourney = createAsyncThunk(
  "journey/preview",
  async ({ origin, destination }, { rejectWithValue }) => {
    try {
      return await previewJourneyRequest({ origin, destination });
    } catch (error) {
      return rejectWithValue(error.message || "Could not preview this road");
    }
  }
);

/**
 * Live vehicles running the corridor between the two points a passenger
 * searched, from the trip planner's single button.
 *
 * Held apart from the driver-side journey state because this is a searched
 * route rather than the passenger's GPS position - the results describe the
 * road they asked about, not the stop they happen to be standing at.
 */
export const searchRouteVehicles = createAsyncThunk(
  "journey/searchRouteVehicles",
  async ({ origin, destination, ...options }, { rejectWithValue }) => {
    try {
      return await searchCorridorVehicles(origin, destination, options);
    } catch (error) {
      return rejectWithValue(error.message || "Could not find vehicles on this route");
    }
  }
);

const journeySlice = createSlice({
  name: "journey",
  initialState: {
    // Driver side
    activeJourney: null,
    path: [],
    stops: [],
    status: "idle", // idle | starting | active | ending | error
    error: null,
    // Per-passenger fares from the last completed journey, for the driver's
    // fare screen. Null until a journey ends.
    lastSettlement: null,
    // Proposed-but-not-started journey: the road preview shown on the start
    // screen. Deliberately not `activeJourney`, so previewing cannot be
    // mistaken for a live trip.
    preview: null,
    previewStatus: "idle", // idle | loading | ready | error
    previewError: null,
    // Whether a resume check has run this session. Distinguishes "checked and
    // there is nothing" from "not checked yet", which is what stops the driver
    // being bounced to a start screen during the gap.
    activeChecked: false,
    // Passenger side
    selectedStop: null,
    // Result of searching a route: the resolved road, its stops, and the live
    // vehicles serving it. Null until searched.
    routeSearch: null,
    routeSearchStatus: "idle", // idle | loading | ready | error
    routeSearchError: null,
  },
  reducers: {
    setSelectedStop: (state, action) => {
      state.selectedStop = action.payload;
    },
    clearJourney: (state) => {
      state.activeJourney = null;
      state.path = [];
      state.stops = [];
      state.status = "idle";
      state.error = null;
      state.preview = null;
      state.previewStatus = "idle";
      state.previewError = null;
      state.routeSearch = null;
      state.routeSearchStatus = "idle";
      state.routeSearchError = null;
      // lastSettlement deliberately survives: it is the fare breakdown the
      // driver has not yet acknowledged, and clearing it here would blank the
      // fare screen before they finish reading it. It is replaced by the next
      // journey's settlement.
    },
    clearPassengerStopState: (state) => {
      state.selectedStop = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(startJourney.pending, (state) => {
        state.status = "starting";
        state.error = null;
      })
      .addCase(startJourney.fulfilled, (state, action) => {
        const data = unwrap(action.payload) || {};
        state.status = "active";
        state.activeJourney = data;
        state.path = data.path || [];
        state.stops = data.stops || [];
        state.error = null;
      })
      .addCase(startJourney.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || action.error?.message || "Could not start your journey";
      })
      .addCase(fetchActiveJourney.pending, (state) => {
        state.activeChecked = false;
      })
      .addCase(fetchActiveJourney.fulfilled, (state, action) => {
        const data = unwrap(action.payload);
        state.activeChecked = true;
        if (!data) {
          // Nothing running. Leave any journey state alone: endJourney already
          // cleared it, and clobbering here would wipe a journey that is still
          // mid-accept.
          return;
        }
        state.status = "active";
        state.activeJourney = data;
        state.path = data.path || [];
        state.stops = data.stops || [];
        state.error = null;
      })
      .addCase(fetchActiveJourney.rejected, (state, action) => {
        // A failed check must not clear a journey we may already be running.
        state.activeChecked = true;
        state.error = action.payload || action.error?.message;
      })
      .addCase(previewJourney.pending, (state) => {
        state.previewStatus = "loading";
        state.previewError = null;
      })
      .addCase(previewJourney.fulfilled, (state, action) => {
        state.previewStatus = "ready";
        state.preview = unwrap(action.payload) || null;
        state.previewError = null;
      })
      .addCase(previewJourney.rejected, (state, action) => {
        state.previewStatus = "error";
        // Drop the stale road so a failed re-preview never leaves the previous
        // journey's path on screen next to the new endpoints.
        state.preview = null;
        state.previewError = action.payload || action.error?.message;
      })
      .addCase(endJourney.pending, (state) => {
        state.status = "ending";
      })
      .addCase(endJourney.fulfilled, (state, action) => {
        state.status = "idle";
        state.activeJourney = null;
        state.path = [];
        state.stops = [];
        // Kept so the driver fare screen can render per-passenger fares without
        // a second request. Cleared by clearJourney() when the driver starts
        // their next journey.
        state.lastSettlement = action.payload || null;
      })
      .addCase(endJourney.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || action.error?.message || "Could not end your journey";
      })
      .addCase(fetchJourney.pending, (state) => {
        state.status = "starting";
      })
      .addCase(fetchJourney.fulfilled, (state, action) => {
        const data = unwrap(action.payload) || {};
        state.status = "active";
        state.activeJourney = data;
        state.path = data.path || [];
        state.stops = data.stops || [];
      })
      .addCase(fetchJourney.rejected, (state, action) => {
        state.status = "idle";
        state.activeJourney = null;
        state.path = [];
        state.stops = [];
        state.error = action.payload || action.error?.message;
      })
      .addCase(searchRouteVehicles.pending, (state) => {
        state.routeSearchStatus = "loading";
        state.routeSearchError = null;
      })
      .addCase(searchRouteVehicles.fulfilled, (state, action) => {
        state.routeSearchStatus = "ready";
        state.routeSearch = unwrap(action.payload) || null;
      })
      .addCase(searchRouteVehicles.rejected, (state, action) => {
        state.routeSearchStatus = "error";
        state.routeSearch = null;
        state.routeSearchError =
          action.payload || action.error?.message || "Could not search this route";
      });
  },
});

export const { setSelectedStop, clearJourney, clearPassengerStopState } =
  journeySlice.actions;
export default journeySlice.reducer;
