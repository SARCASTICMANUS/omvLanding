import { combineReducers } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import driverReducer from "./slices/driverSlice";
import liveBusReducer from "./slices/liveBusSlice";
import passengerReducer from "./slices/passengerSlice";
import routeReducer from "./slices/routeSlice";
import trackingReducer from "./slices/trackingSlice";
import websocketReducer from "./slices/websocketSlice";
import { vayyApi } from "./api/vayyApi";

export const rootReducer = combineReducers({
  auth: authReducer,
  routes: routeReducer,
  tracking: trackingReducer,
  websocket: websocketReducer,
  liveBus: liveBusReducer,
  passenger: passengerReducer,
  driver: driverReducer,
  [vayyApi.reducerPath]: vayyApi.reducer,
});

