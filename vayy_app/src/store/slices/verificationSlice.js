import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { AUTH } from "../../constants";

/**
 * Verification is SERVER-CONTROLLED. The backend derives it live from the DB on
 * every request (verification_service.verification_state), so it is identical
 * for web and mobile. Nothing here is persisted: every cold start, foreground
 * and login re-reads GET /api/accounts/me/ -> data.verification.
 */
export const fetchVerification = createAsyncThunk(
  "verification/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get(AUTH.me);
      // MeView returns { success, message, data: { ..., user, verification } }.
      const data = res.data?.data ?? res.data ?? {};
      return {
        state: data.verification ?? data.user?.verification ?? null,
        user: data.user ?? null,
      };
    } catch (error) {
      // The API client turns 403 verification_required into a structured
      // rejection carrying the server's state block — honour it verbatim.
      if (error?.verificationState) {
        return rejectWithValue({ verificationState: error.verificationState });
      }
      return rejectWithValue(
        error?.response?.data || error?.message || "Failed to fetch verification",
      );
    }
  },
);

const initialState = {
  state: null, // {stage, can_use_app, title, message, required_docs, uploaded_docs, missing_docs, rejection_reason, submitted_at}
  user: null,
  loading: false,
  loaded: false, // true once the server has answered at least once this session
  error: null,
};

const verificationSlice = createSlice({
  name: "verification",
  initialState,
  reducers: {
    clearVerification: (state) => {
      state.state = null;
      state.user = null;
      state.loaded = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVerification.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVerification.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.state = action.payload.state;
        state.user = action.payload.user;
      })
      .addCase(fetchVerification.rejected, (state, action) => {
        state.loading = false;
        const vs = action.payload?.verificationState;
        if (vs) {
          // Server explicitly said "verification required" — show its block.
          state.loaded = true;
          state.state = vs;
        } else {
          // Network / 5xx / auth hiccup: we do NOT know the answer. Keep
          // whatever the server last told us and never invent a "blocked"
          // state. Real enforcement is the server's 403 on gated endpoints.
          state.error = action.payload ?? "Failed to fetch verification";
        }
      });
  },
});

export const { clearVerification } = verificationSlice.actions;
export default verificationSlice.reducer;
