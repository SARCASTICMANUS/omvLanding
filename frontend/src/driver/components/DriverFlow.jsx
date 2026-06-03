import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import api from "../../lib/api";
import { getStopLngLat } from "../../components/map/utils/routeGeometry";
import { API_PATHS } from "../../constants/apiPaths";
import {
  setStep,
  setDriverActiveTrip,
  setSelectedRoute,
  setSearchQuery,
  resetDriverState,
  setDriverLoading,
  setDriverStatus,
  setAssignedRoutes,
  setDriverError,
} from "../../redux/slices/driverSlice";
import {
  buildRouteSummary,
  filterRoutesForDriver,
  getOrderedRouteStops,
  getRouteEndpoints,
  mergeRoutePreview,
  normalizeDriverRoutes,
} from "./driverFlowUtils";
import DriverLiveTracking from "./DriverLiveTracking";
import DriverRouteList from "./DriverRouteList";
import DriverStopsTimeline from "./DriverStopsTimeline";
import DriverTripPlanner from "./DriverTripPlanner";
import DriverTripReview from "./DriverTripReview";

const STEPS = {
  PLANNER: "planner",
  ROUTES: "routes",
  REVIEW: "review",
  LIVE: "live",
};

export default function DriverFlow() {
  const dispatch = useDispatch();
  const [previewMode, setPreviewMode] = useState("");
  const [allRoutes, setAllRoutes] = useState([]);
  const [matchingRoutes, setMatchingRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);

  const { currentStep, activeTrip, selectedRoute, source, destination, loading } = useSelector(
    (state) => state.driver,
  );

  // Synchronization effect on mount/refresh
  useEffect(() => {
    const syncTripStatus = async () => {
      if (currentStep === "live" && activeTrip?.id) {
        try {
          dispatch(setDriverLoading(true));
          const response = await api.get(API_PATHS.driver.tripStatus(activeTrip.id));
          if (response.data.status !== "active") {
            dispatch(resetDriverState());
          }
        } catch (e) {
          console.error("Health check failed", e);
          if (e.response?.status === 404) {
            dispatch(resetDriverState());
          }
        } finally {
          dispatch(setDriverLoading(false));
        }
      }
    };
    syncTripStatus();
  }, [activeTrip?.id, dispatch]);

  const fetchDriverRoutes = async (from = null, to = null) => {
    let url = "/api/driver/routes/";
    if (from && to) {
      const params = new URLSearchParams({
        source_lat: from.lat,
        source_lon: from.lon,
        source_name: from.name || from.display_name || "",
        dest_lat: to.lat,
        dest_lon: to.lon,
        dest_name: to.name || to.display_name || "",
      });
      url += `?${params.toString()}`;
    }

    try {
      const response = await api.get(url);
      return normalizeDriverRoutes(response.data).map(buildRouteSummary);
    } catch (error) {
      console.warn("Driver route search failed, falling back to full list", error);
      const response = await api.get("/api/routes/");
      return normalizeDriverRoutes(response.data).map(buildRouteSummary);
    }
  };

  const fetchPreviewForRoute = async (route) => {
    const orderedStops = getOrderedRouteStops(route);
    const { start, end } = getRouteEndpoints(route);

    if (!start || !end) return route;

    try {
      const response = await api.post(API_PATHS.admin.routePreview, {
        start: { lat: start[1], lon: start[0] },
        end: { lat: end[1], lon: end[0] },
        stops: orderedStops
          .map((stop, index) => {
            const coord = getStopLngLat(stop);
            if (!coord) return null;
            return {
              lat: coord[1],
              lon: coord[0],
              name: stop.name,
              order: stop.order ?? index,
            };
          })
          .filter(Boolean),
      });

      return mergeRoutePreview(route, response.data);
    } catch (error) {
      console.error("Failed to preview route", error);
      return route;
    }
  };

  const handlePlannerNext = async ({ from, to }) => {
    dispatch(setSearchQuery({ source: from, destination: to }));

    // Save to recent searches - using passenger endpoint as a known working path
    api.post("/api/passenger/recent-searches/", { pickup: from, destination: to })
      .catch(err => console.error("Failed to save recent search", err));

    try {
      setLoadingRoutes(true);
      const routes = await fetchDriverRoutes(from, to);
      const filteredRoutes = filterRoutesForDriver(routes, from, to);

      setAllRoutes(routes);
      setMatchingRoutes(filteredRoutes.length ? filteredRoutes : routes);
      dispatch(setAssignedRoutes(routes.map((route) => route.id).filter(Boolean)));
      dispatch(setStep(STEPS.ROUTES));
    } catch (error) {
      console.error("Failed to fetch driver routes", error);
      setAllRoutes([]);
      setMatchingRoutes([]);
      dispatch(setDriverError("Failed to load driver routes"));
      dispatch(setStep(STEPS.ROUTES));
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleSelectRoute = async (route) => {
    dispatch(setDriverLoading(true));
    const hydratedRoute = await fetchPreviewForRoute(route);
    dispatch(setSelectedRoute(hydratedRoute));
    dispatch(setStep(STEPS.REVIEW));
    dispatch(setDriverLoading(false));
  };

  const handleStartTrip = async () => {
    if (!selectedRoute?.id) return;

    try {
      setStartingTrip(true);
      dispatch(setDriverStatus("starting"));
      const response = await api.post(API_PATHS.driver.startTrip, {
        route_id: selectedRoute.id,
      });
      const actualTripId = response.data?.trip_id || response.data?.id;

      const mergedTrip = buildRouteSummary({
        ...selectedRoute,
        ...response.data,
        id: actualTripId,
        trip_id: actualTripId,
        vehicle_id: response.data?.vehicle_id || selectedRoute.vehicle_id,
        stops: Array.isArray(response.data?.stops) && response.data.stops.length
            ? response.data.stops
            : selectedRoute.stops,
      });

      dispatch(setDriverActiveTrip(mergedTrip));
      dispatch(setDriverStatus("active"));
    } catch (error) {
      console.error("Failed to start trip", error);
      dispatch(setDriverError("Failed to start trip"));
      dispatch(setDriverStatus("idle"));
    } finally {
      setStartingTrip(false);
    }
  };

  if (previewMode === "routes") {
    return (
      <DriverRouteList
        source={source}
        destination={destination}
        routes={allRoutes}
        allRoutesCount={allRoutes.length}
        onBack={() => setPreviewMode("")}
        onSelectRoute={() => setPreviewMode("review")}
      />
    );
  }

  if (previewMode === "review") {
    return (
      <DriverTripReview
        route={selectedRoute}
        source={source}
        destination={destination}
        onBack={() => setPreviewMode("")}
        onStartTrip={() => setPreviewMode("live")}
      />
    );
  }

  if (currentStep === "live") {
    return (
      <div className="relative h-screen">
        <DriverLiveTracking
            activeTrip={activeTrip}
            onBack={() => dispatch(setStep("review"))}
        />
        {loading && (
             <div className="absolute inset-0 z-[5000] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
                <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
                    <div className="w-6 h-6 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-800 font-bold text-sm">Refreshing session...</span>
                </div>
             </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <span className="text-white font-bold tracking-tight">Syncing Context...</span>
        </div>
      </div>
    );
  }

  if (currentStep === STEPS.PLANNER) {
    return (
      <DriverTripPlanner
        initialSource={source}
        initialDestination={destination}
        loading={loadingRoutes}
        onNext={handlePlannerNext}
        onOpenPreview={setPreviewMode}
      />
    );
  }

  if (currentStep === STEPS.ROUTES) {
    return (
      <DriverRouteList
        source={source}
        destination={destination}
        routes={matchingRoutes}
        allRoutesCount={allRoutes.length}
        loading={loadingRoutes}
        onBack={() => dispatch(setStep(STEPS.PLANNER))}
        onSelectRoute={handleSelectRoute}
      />
    );
  }

  if (currentStep === STEPS.REVIEW) {
    return (
      <DriverTripReview
        route={selectedRoute}
        source={source}
        destination={destination}
        onBack={() => dispatch(setStep(STEPS.ROUTES))}
        onStartTrip={handleStartTrip}
        starting={startingTrip}
      />
    );
  }

  return null;
}
