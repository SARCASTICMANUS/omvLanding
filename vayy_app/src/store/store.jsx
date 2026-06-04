import { configureStore } from "@reduxjs/toolkit";

import {
  logout,
  refreshTokenSuccess,
  default as authReducer,
} from "../auth/authSlice";
import vehicleModeReducer from "./slices/vehicleModeSlice";
import { configureAuthHandlers } from "../shared/lib/api";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    vehicleMode: vehicleModeReducer,
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
