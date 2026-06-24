import { configureStore } from "@reduxjs/toolkit";

import {
  logout,
  refreshTokenSuccess,
  default as authReducer,
} from "../auth/authSlice";
import vehicleModeReducer from "./slices/vehicleModeSlice";
import rideFlowReducer from "./slices/rideFlowSlice";
import autoMatchingReducer from "./slices/autoMatchingSlice";
import autoRideReducer from "./slices/autoRideSlice";
import bikeRideReducer from "./slices/bikeRideSlice";
import { configureAuthHandlers } from "../shared/lib/api";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    vehicleMode: vehicleModeReducer,
    rideFlow: rideFlowReducer,
    autoMatching: autoMatchingReducer,
    autoRide: autoRideReducer,
    bikeRide: bikeRideReducer,
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
