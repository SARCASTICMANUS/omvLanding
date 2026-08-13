import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";

const routesAdapter = createEntityAdapter({
  selectId: (route) => route.id,
  sortComparer: (a, b) => String(a.name || "").localeCompare(String(b.name || "")),
});

const initialState = routesAdapter.getInitialState({
  selectedRouteId: null,
  activeRoutePath: [],
  activeCityCode: null,
  loading: false,
  error: null,
});

const routeSlice = createSlice({
  name: "routes",
  initialState,
  reducers: {
    setRoutes: routesAdapter.setAll,
    upsertRoute: routesAdapter.upsertOne,
    upsertRoutes: routesAdapter.upsertMany,
    removeRoute: routesAdapter.removeOne,
    selectRoute: (state, action) => {
      state.selectedRouteId = action.payload;
    },
    setActiveRoutePath: (state, action) => {
      state.activeRoutePath = action.payload || [];
    },
    setRouteLoading: (state, action) => {
      state.loading = action.payload;
    },
    setRouteError: (state, action) => {
      state.error = action.payload;
    },
    setActiveCityCode: (state, action) => {
      state.activeCityCode = action.payload;
    },
    clearRouteState: (state) => {
      state.selectedRouteId = null;
      state.activeRoutePath = [];
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  setRoutes,
  upsertRoute,
  upsertRoutes,
  removeRoute,
  selectRoute,
  setActiveRoutePath,
  setRouteLoading,
  setRouteError,
  setActiveCityCode,
  clearRouteState,
} = routeSlice.actions;

export const routeSelectors = routesAdapter.getSelectors((state) => state.routes);
export default routeSlice.reducer;

