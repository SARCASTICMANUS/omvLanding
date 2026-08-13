import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../shared/lib/api";
import { AUTH } from "../../constants";

export const fetchWallet = createAsyncThunk(
  "wallet/fetchWallet",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get(AUTH.wallet);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch wallet");
    }
  }
);

export const addFunds = createAsyncThunk(
  "wallet/addFunds",
  async (amount, { rejectWithValue }) => {
    try {
      const response = await api.post(AUTH.walletAddFunds, { amount });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to add funds");
    }
  }
);

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    balance: "0.00",
    transactions: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWallet.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWallet.fulfilled, (state, action) => {
        state.loading = false;
        state.balance = action.payload.wallet.balance;
        state.transactions = action.payload.transactions;
      })
      .addCase(fetchWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(addFunds.pending, (state) => {
        state.loading = true;
      })
      .addCase(addFunds.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions.unshift(action.payload);
        state.balance = (parseFloat(state.balance) + parseFloat(action.meta.arg)).toFixed(2);
      })
      .addCase(addFunds.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default walletSlice.reducer;
