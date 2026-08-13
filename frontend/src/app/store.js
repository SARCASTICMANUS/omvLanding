// VAYY | src/app/store.js
// Central Redux store. Auth remains the only persisted slice for migration safety.

import { configureStore } from "@reduxjs/toolkit";
import {
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import { rootReducer } from "../redux/rootReducer";
import { vayyApi } from "../redux/api/vayyApi";

// const persistConfig = {
//   key: "vayy-root",
//   version: 1,
//   storage,
//   whitelist: ["auth"],
// };

// const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(vayyApi.middleware),
});

export const persistor = persistStore(store);
