import { configureStore } from "@reduxjs/toolkit";

import {
  logout,
  refreshTokenSuccess,
  default as authReducer,
} from "../features/auth/authSlice";
import { configureAuthHandlers } from "../lib/api";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

configureAuthHandlers({
  onRefreshToken: (payload) => store.dispatch(refreshTokenSuccess(payload)),
  onUnauthorized: () => store.dispatch(logout()),
});

export default store;
