import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  connections: {},
  lastEvent: null,
  eventCount: 0,
};

const websocketSlice = createSlice({
  name: "websocket",
  initialState,
  reducers: {
    socketConnectionChanged: (state, action) => {
      const { key, status, url, error, connectedAt, closedAt } = action.payload;
      state.connections[key] = {
        key,
        url,
        status,
        error: error || null,
        connectedAt: connectedAt || state.connections[key]?.connectedAt || null,
        closedAt: closedAt || null,
      };
    },
    socketEventReceived: (state, action) => {
      state.lastEvent = {
        key: action.payload.key,
        type: action.payload.type,
        receivedAt: action.payload.receivedAt || Date.now(),
      };
      state.eventCount += 1;
    },
    socketConnectionRemoved: (state, action) => {
      delete state.connections[action.payload];
    },
  },
});

export const {
  socketConnectionChanged,
  socketEventReceived,
  socketConnectionRemoved,
} = websocketSlice.actions;

export default websocketSlice.reducer;

