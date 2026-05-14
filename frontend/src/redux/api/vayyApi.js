import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { env } from "../../config/env";
import { API_PATHS } from "../../constants/apiPaths";

export const vayyApi = createApi({
  reducerPath: "vayyApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiUrl,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem("token");
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Auth", "Routes", "Driver", "Passenger", "Tracking", "LiveBus"],
  endpoints: (builder) => ({
    getDriverRoutes: builder.query({
      query: () => API_PATHS.driver.routes,
      providesTags: ["Routes", "Driver"],
    }),
    getDriverTripStatus: builder.query({
      query: (tripId) => API_PATHS.driver.tripStatus(tripId),
      providesTags: ["Driver", "Tracking"],
    }),
    startDriverTrip: builder.mutation({
      query: (routeId) => ({
        url: API_PATHS.driver.startTrip,
        method: "POST",
        body: { route_id: routeId },
      }),
      invalidatesTags: ["Driver", "Tracking"],
    }),
    previewRoute: builder.mutation({
      query: (body) => ({
        url: API_PATHS.admin.routePreview,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Routes"],
    }),
  }),
});

export const {
  useGetDriverRoutesQuery,
  useGetDriverTripStatusQuery,
  useStartDriverTripMutation,
  usePreviewRouteMutation,
} = vayyApi;

