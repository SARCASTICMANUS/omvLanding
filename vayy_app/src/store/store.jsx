import { configureStore } from "@reduxjs/toolkit";

import {
  logout as logoutUser,
  refreshTokenSuccess,
  default as authReducer,
} from "../auth/authSlice";
import vehicleModeReducer from "./slices/vehicleModeSlice";
import tripReducer from "./slices/tripSlice";
import walletReducer from "./slices/walletSlice";
import trackingReducer from "./slices/trackingSlice";
import notificationReducer from "./slices/notificationSlice";
import profileReducer from "./slices/profileSlice";
import verificationReducer from "./slices/verificationSlice";
import dispatchReducer from "./slices/dispatchSlice";
import rideReducer from "./slices/rideSlice";
import autoRideReducer from "./slices/autoRideSlice";
import bikeRideReducer from "./slices/bikeRideSlice";
import rideFlowReducer from "./slices/rideFlowSlice";
import adminReducer from "../admin/adminSlice";
import onboardingReducer from "./slices/onboardingSlice";
import { configureAuthHandlers } from "../shared/lib/api";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    vehicleMode: vehicleModeReducer,
    trip: tripReducer,
    wallet: walletReducer,
    tracking: trackingReducer,
    notifications: notificationReducer,
    profile: profileReducer,
    verification: verificationReducer,
    dispatch: dispatchReducer,
    ride: rideReducer,
    autoRide: autoRideReducer,
    bikeRide: bikeRideReducer,
    rideFlow: rideFlowReducer,
    admin: adminReducer,
    onboarding: onboardingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

configureAuthHandlers({
  onRefreshToken: (payload) => store.dispatch(refreshTokenSuccess(payload)),
  onUnauthorized: () => store.dispatch(logoutUser()),
});

export default store;
