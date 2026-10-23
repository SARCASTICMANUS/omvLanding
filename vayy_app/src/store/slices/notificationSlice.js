import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api, { unwrapList } from "../../shared/lib/api";
import { COMMUNICATION } from "../../constants";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get(COMMUNICATION.notifications);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to fetch notifications");
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  "notifications/markRead",
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.patch(`${COMMUNICATION.notifications}${id}/read/`);
      return { id, data: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to mark as read");
    }
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    list: [],
    unreadCount: 0,
    loading: false,
    error: null,
  },
  reducers: {
    addNotification: (state, action) => {
      state.list.unshift(action.payload);
      if (!action.payload.read) {
        state.unreadCount += 1;
      }
    },
    clearUnreadCount: (state) => {
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.list = unwrapList(action.payload);
        state.unreadCount = state.list.filter((n) => !n.read).length;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const index = state.list.findIndex(n => n.id === action.payload.id);
        if (index !== -1) {
          state.list[index].read = true;
          if (state.unreadCount > 0) state.unreadCount -= 1;
        }
      });
  },
});

export const { addNotification, clearUnreadCount } = notificationSlice.actions;
export default notificationSlice.reducer;
