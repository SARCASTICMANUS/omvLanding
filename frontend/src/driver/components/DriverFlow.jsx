import React, { useState } from "react";
import { useDispatch } from "react-redux";
import api from "../../lib/api";
import { getStopLngLat } from "../../components/map/utils/routeGeometry";
import { API_PATHS } from "../../constants/apiPaths";
import {
  resetDriverState,
  setAssignedRoutes,
  setDriverActiveTrip,
  setDriverError,
  setDriverLoading,
  setDriverStatus,
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
  const [step, setStep] = useState(STEPS.PLANNER);
  const [previewMode, setPreviewMode] = useState("");
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [allRoutes, setAllRoutes] = useState([]);
  const [matchingRoutes, setMatchingRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [startingTrip, setStartingTrip] = useState(false);

  const previewSource = {
    name: "City Depot",
    display_name: "City Depot, Main Corridor",
    lat: 28.6139,
    lon: 77.209,
  };

  const previewDestination = {
    name: "Central Campus",
    display_name: "Central Campus, Innovation District",
    lat: 28.7041,
    lon: 77.1025,
  };

  const previewRoute = buildRouteSummary({
    id: "preview-route-12",
    name: "East Corridor Express",
    route_code: "RT-201",
    status: "active",
    active_trip_count: 1,
    total_distance: 18200,
    duration_minutes: 46,
    vehicle_number: "KA01 AB 4589",
    vehicle_type: "Electric Coach",
    previewPath: [
      [77.209, 28.6139],
      [77.197, 28.628],
      [77.178, 28.648],
      [77.153, 28.671],
      [77.132, 28.689],
      [77.1025, 28.7041],
    ],
    stops: [
      { id: "s1", name: "City Depot", order: 1, lat: 28.6139, lon: 77.209, is_boarding_point: true, arrival_time: "06:45 AM" },
      { id: "s2", name: "Lake View Stop", order: 2, lat: 28.628, lon: 77.197, pickup_allowed: true, arrival_time: "06:58 AM" },
      { id: "s3", name: "North Gate", order: 3, lat: 28.648, lon: 77.178, pickup_allowed: true, arrival_time: "07:12 AM" },
      { id: "s4", name: "Tech Park Loop", order: 4, lat: 28.671, lon: 77.153, pickup_allowed: true, arrival_time: "07:24 AM" },
      { id: "s5", name: "Central Campus", order: 5, lat: 28.7041, lon: 77.1025, arrival_time: "07:31 AM" },
    ],
  });

  const previewRouteList = [
    previewRoute,
    buildRouteSummary({
      id: "preview-route-24",
      name: "North Academic Loop",
      route_code: "RT-114",
      status: "inactive",
      total_distance: 14600,
      duration_minutes: 39,
      stops: [
        { id: "n1", name: "North Hub", order: 1, lat: 28.634, lon: 77.182 },
        { id: "n2", name: "Sector 18", order: 2, lat: 28.655, lon: 77.161 },
        { id: "n3", name: "Innovation Block", order: 3, lat: 28.688, lon: 77.126 },
      ],
    }),
  ];

  const previewTrip = {
    ...previewRoute,
    trip_id: "preview-trip-12",
    route_id: previewRoute.id,
    route_name: previewRoute.title,
    vehicle_id: "VAYY-12A",
    total_distance: previewRoute.distanceMeters,
    stops: previewRoute.stops,
  };

  const fetchDriverRoutes = async () => {
    try {
      const response = await api.get("/api/routes/");
      return normalizeDriverRoutes(response.data).map(buildRouteSummary);
    } catch (error) {
      console.warn("Full route library fetch failed, falling back to driver route endpoint", error);
      const response = await api.get(API_PATHS.driver.routes);
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
    setSource(from);
    setDestination(to);
    setSelectedRoute(null);
    setActiveTrip(null);
    dispatch(resetDriverState());

    try {
      setLoadingRoutes(true);
      dispatch(setDriverLoading(true));
      const routes = await fetchDriverRoutes();
      const filteredRoutes = filterRoutesForDriver(routes, from, to);

      setAllRoutes(routes);
      setMatchingRoutes(filteredRoutes.length ? filteredRoutes : routes);
      dispatch(setAssignedRoutes(routes.map((route) => route.id).filter(Boolean)));
      setStep(STEPS.ROUTES);
    } catch (error) {
      console.error("Failed to fetch driver routes", error);
      setAllRoutes([]);
      setMatchingRoutes([]);
      dispatch(setDriverError("Failed to load driver routes"));
      setStep(STEPS.ROUTES);
    } finally {
      setLoadingRoutes(false);
      dispatch(setDriverLoading(false));
    }
  };

  const handleSelectRoute = async (route) => {
    setLoadingRoutes(true);
    const hydratedRoute = await fetchPreviewForRoute(route);
    setSelectedRoute(hydratedRoute);
    setStep(STEPS.REVIEW);
    setLoadingRoutes(false);
  };

  const handleStartTrip = async () => {
    if (!selectedRoute?.id) return;

    try {
      setStartingTrip(true);
      dispatch(setDriverStatus("starting"));
      const response = await api.post(API_PATHS.driver.startTrip, {
        route_id: selectedRoute.id,
      });

      const mergedTrip = buildRouteSummary({
        ...selectedRoute,
        ...response.data,
        trip_id: response.data?.trip_id || response.data?.id || selectedRoute.trip_id,
        vehicle_id: response.data?.vehicle_id || selectedRoute.vehicle_id,
        stops:
          Array.isArray(response.data?.stops) && response.data.stops.length
            ? response.data.stops
            : selectedRoute.stops,
      });

      setActiveTrip(mergedTrip);
      dispatch(setDriverActiveTrip(mergedTrip));
      dispatch(setDriverStatus("active"));
      setStep(STEPS.LIVE);
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
        source={previewSource}
        destination={previewDestination}
        routes={previewRouteList}
        allRoutesCount={previewRouteList.length}
        onBack={() => setPreviewMode("")}
        onSelectRoute={() => setPreviewMode("review")}
      />
    );
  }

  if (previewMode === "review") {
    return (
      <DriverTripReview
        route={previewRoute}
        source={previewSource}
        destination={previewDestination}
        onBack={() => setPreviewMode("")}
        onStartTrip={() => setPreviewMode("live")}
      />
    );
  }

  if (previewMode === "timeline") {
    return (
      <div className="h-screen overflow-hidden bg-slate-950 px-4 pb-4 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-full max-w-5xl flex-col">
          <button
            type="button"
            onClick={() => setPreviewMode("")}
            className="mb-4 w-fit rounded-[18px] border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-slate-200"
          >
            Back to Planner
          </button>
          <DriverStopsTimeline route={previewRoute} currentStopIndex={2} className="flex-1 overflow-hidden" />
        </div>
      </div>
    );
  }

  if (previewMode === "live") {
    return (
      <DriverLiveTracking
        route={previewRoute}
        activeTrip={previewTrip}
        onBack={() => setPreviewMode("")}
      />
    );
  }

  if (step === STEPS.PLANNER) {
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

  if (step === STEPS.ROUTES) {
    return (
      <DriverRouteList
        source={source}
        destination={destination}
        routes={matchingRoutes}
        allRoutesCount={allRoutes.length}
        loading={loadingRoutes}
        onBack={() => setStep(STEPS.PLANNER)}
        onSelectRoute={handleSelectRoute}
      />
    );
  }

  if (step === STEPS.REVIEW) {
    return (
      <DriverTripReview
        route={selectedRoute}
        source={source}
        destination={destination}
        onBack={() => setStep(STEPS.ROUTES)}
        onStartTrip={handleStartTrip}
        starting={startingTrip}
      />
    );
  }

  if (step === STEPS.LIVE) {
    return (
      <DriverLiveTracking
        route={selectedRoute}
        activeTrip={activeTrip}
        onBack={() => setStep(STEPS.REVIEW)}
      />
    );
  }

  return null;
}
