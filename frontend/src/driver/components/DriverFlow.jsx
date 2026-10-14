import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { CircleStop, LoaderCircle } from "lucide-react";
import api from "../../lib/api";
import { getStopLngLat } from "../../components/map/utils/routeGeometry";
import { API_PATHS } from "../../constants/apiPaths";
import {
  setStep,
  setDriverActiveTrip,
  setActiveRide,
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
import {
  fetchDynamicRoutes,
  isDynamicRouteCreationEnabled,
} from "../../services/routes/routeProvider";
import DriverBuddyRadar from "./DriverBuddyRadar";
import DriverLiveTracking from "./DriverLiveTracking";
import DriverOtpEntry from "./DriverOtpEntry";
import DriverPickup from "./DriverPickup";
import DriverPreRideCheck from "./DriverPreRideCheck";
import DriverRouteList from "./DriverRouteList";
import DriverTripComplete from "./DriverTripComplete";
import DriverTripPlanner from "./DriverTripPlanner";

const STEPS = {
  PLANNER: "planner",
  ROUTES: "routes",
  PREFLIGHT: "preflight",
  RADAR: "radar",
  PICKUP: "pickup",
  OTP: "otp",
  LIVE: "live",
  COMPLETE: "complete",
};

const BROADCAST_ACCEPT = (requestId) =>
  `/api/operations/dispatch/broadcast/${requestId}/accept/`;
const BROADCAST_REJECT = (requestId) =>
  `/api/operations/dispatch/broadcast/${requestId}/reject/`;
const RIDE_EARNINGS_TODAY = "/api/ride/earnings/?period=today";
const RIDE_FARE = (tripId) => `/api/ride/trip/${tripId}/fare/`;

export default function DriverFlow() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [allRoutes, setAllRoutes] = useState([]);
  const [matchingRoutes, setMatchingRoutes] = useState([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [rideResult, setRideResult] = useState(null);
  const [endingRide, setEndingRide] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [routeError, setRouteError] = useState("");

  const {
    currentStep,
    activeTrip,
    activeRide,
    selectedRoute,
    source,
    destination,
    loading,
  } = useSelector((state) => state.driver);

  /* Vehicle type + city are read from the authenticated profile — the planner
     never captured them, so this is the existing source, not a new state. */
  const user = useSelector((state) => state.auth?.user);
  const driverVehicleType = user?.role === "autodriver" ? "auto" : "bike";
  const driverCityId = user?.city ?? null;

  // Synchronization effect on mount/refresh
  useEffect(() => {
    const syncTripStatus = async () => {
      if (currentStep === STEPS.LIVE && activeTrip?.id) {
        try {
          dispatch(setDriverLoading(true));
          const response = await api.get(API_PATHS.driver.tripStatus(activeTrip.id));
          if (response.data.status !== "active") {
            dispatch(resetDriverState());
          }
        } catch (e) {
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

  useEffect(() => {
    if (
      (currentStep === STEPS.PICKUP || currentStep === STEPS.OTP) &&
      !activeRide?.tripId
    ) {
      dispatch(setStep(STEPS.RADAR));
    }
  }, [currentStep, activeRide?.tripId, dispatch]);

  const fetchDriverRoutes = async (from = null, to = null) => {
    // ==========================================================================
    // DYNAMIC ROUTE CREATION — ACTIVE (DYNAMIC_ROUTE_CREATION_ENABLED = true)
    //
    // The origin/destination chosen in the existing planner are posted to the
    // backend Dynamic Route API. Django resolves both points, calls OSRM once
    // for the real road route, discovers OMV stops along the corridor and
    // returns the generated route. The response is mapped by
    // normalizeDynamicRoute() into the exact shape the existing Route Card
    // already renders, so only the data source changed.
    // ==========================================================================
    if (isDynamicRouteCreationEnabled()) {
      const { routes } = await fetchDynamicRoutes({
        audience: "driver",
        origin: from,
        destination: to,
        cityId: driverCityId,
        vehicleType: driverVehicleType,
      });
      return routes.map(buildRouteSummary);
    }

    // ==========================================================================
    // LEGACY FIXED-ROUTE FETCH — REPLACED BY DYNAMIC ROUTE CREATION
    //
    // Previous behaviour:
    //   fetch an existing manually traced route and render it.
    //
    // Current behaviour (when DYNAMIC_ROUTE_CREATION_ENABLED = true):
    //   request a route from the dynamic route API above.
    //
    // Retained temporarily for rollback/reference.
    // Do not use when dynamic route creation is enabled.
    // Set VITE_DYNAMIC_ROUTE_CREATION_ENABLED=false to restore this path.
    // ==========================================================================
    const searchingByLocation = Boolean(from && to);
    const params = searchingByLocation
      ? {
          origin_lat: from.lat,
          origin_lng: from.lon,
          dest_lat: to.lat,
          dest_lng: to.lon,
          radius: 5000,
          role: "driver",
        }
      : undefined;
    const endpoint = searchingByLocation
      ? API_PATHS.transport.routeSearchByLocation
      : API_PATHS.driver.routes;
    const response = await api.get(endpoint, { params });
    return normalizeDriverRoutes(response.data).map(buildRouteSummary);
  };

  const fetchPreviewForRoute = async (route) => {
    const orderedStops = getOrderedRouteStops(route);
    const { start, end } = getRouteEndpoints(route);

    if (!start || !end) return route;

    // ==========================================================================
    // LEGACY FIXED-ROUTE FETCH — REPLACED BY DYNAMIC ROUTE CREATION
    //
    // Previous behaviour:
    //   ask the backend to re-route the selected fixed route just to hydrate
    //   a preview polyline on the card.
    //
    // Current behaviour:
    //   skipped for generated routes — the OSRM geometry already travelled with
    //   the dynamic route response, and the browser must never issue a second
    //   routing request.
    //
    // Retained for rollback/reference (fixed routes, flag off).
    // ==========================================================================
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
    api.post(API_PATHS.auth.recentSearches, {
      pickup_name: from?.name || from?.display_name || "",
      pickup_lat: from?.lat || 0,
      pickup_lon: from?.lon || 0,
      destination_name: to?.name || to?.display_name || "",
      destination_lat: to?.lat || 0,
      destination_lon: to?.lon || 0,
    })
      .catch(err => console.error("Failed to save recent search", err));

    const dynamicMode = isDynamicRouteCreationEnabled();

    try {
      setLoadingRoutes(true);
      setRouteError("");
      dispatch(setDriverError(null));
      const routes = await fetchDriverRoutes(from, to);
      // Dynamic routes arrive already matched to the requested origin and
      // destination, and the backend owns their ordering — the legacy geo/text
      // relevance filter is only meaningful for the fixed-route catalogue.
      const filteredRoutes = dynamicMode
        ? routes
        : filterRoutesForDriver(routes, from, to);

      setAllRoutes(routes);
      setMatchingRoutes(filteredRoutes.length ? filteredRoutes : routes);
      dispatch(setAssignedRoutes(routes.map((route) => route.id).filter(Boolean)));
      dispatch(setStep(STEPS.ROUTES));
    } catch (error) {
      console.error("Failed to fetch driver routes", error);
      setAllRoutes([]);
      setMatchingRoutes([]);
      // Only the pre-approved, user-safe copy reaches the Route Card.
      const message = error?.isDynamicRouteError
        ? error.message
        : "Failed to load driver routes";
      setRouteError(message);
      dispatch(setDriverError(message));
      dispatch(setStep(STEPS.ROUTES));
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleSelectRoute = async (route) => {
    dispatch(setDriverLoading(true));
    // A generated route already carries the backend's OSRM geometry, ordered
    // stops and authoritative fare, so Continue forwards it untouched. Only the
    // legacy fixed-route path still needs the preview round-trip.
    const hydratedRoute =
      route?.source === "dynamic" ? route : await fetchPreviewForRoute(route);
    dispatch(setSelectedRoute(hydratedRoute));
    dispatch(setStep(STEPS.PREFLIGHT));
    dispatch(setDriverLoading(false));
  };

  const handleAcceptRide = async (ride) => {
    try {
      let tripId = ride.tripId || null;
      let otp = ride.otp || null;

      if (ride.requestId) {
        const response = await api.post(BROADCAST_ACCEPT(ride.requestId));
        const data = response.data || {};
        if (data.status !== "accepted") {
          return {
            ok: false,
            error:
              data.message ||
              (data.status === "no_vehicle"
                ? "No active vehicle found for this driver"
                : "Ride no longer available"),
          };
        }
        tripId = data.trip_id || tripId;
        otp = data.otp || otp;
      } else if (tripId) {
        try {
          const response = await api.patch(API_PATHS.dispatchAccept(tripId));
          const payload = response.data || {};
          if (payload.success === false) {
            return { ok: false, error: payload.message || "Could not accept this request" };
          }
          tripId = payload.data?.id || tripId;
          otp = payload.data?.otp || otp;
        } catch (acceptError) {
          // Already accepted by us (e.g. after a refresh) is still a success.
          const detail = await api.get(API_PATHS.dispatchDetail(tripId)).catch(() => null);
          const status = detail?.data?.status;
          if (!["accepted", "arrived", "active"].includes(status)) {
            throw acceptError;
          }
          tripId = detail.data?.id || tripId;
          otp = detail.data?.otp || otp;
        }
      } else {
        return { ok: false, error: "This request has no trip reference" };
      }

      dispatch(
        setActiveRide({
          ...ride,
          tripId,
          dispatchId: tripId,
          otp,
        }),
      );
      dispatch(setDriverStatus("assigned"));

      dispatch(setStep(STEPS.PICKUP));
      return { ok: true };
    } catch (error) {
      const data = error?.response?.data || {};
      return {
        ok: false,
        error: data.message || data.detail || "Could not accept this request",
      };
    }
  };

  const handleSkipRide = (ride) => {
    if (ride?.requestId) {
      api.post(BROADCAST_REJECT(ride.requestId)).catch(() => {});
    }
  };

  const handlePickupBack = () => {
    if (activeRide?.tripId) {
      api
        .post(API_PATHS.dispatchCancel(activeRide.tripId), { reason: "driver_abandoned" })
        .catch(() => {});
    }
    dispatch(setActiveRide(null));
    dispatch(setDriverStatus("idle"));
    dispatch(setStep(STEPS.RADAR));
  };

  const handleVerified = async (tripId) => {
    let detail = null;
    try {
      const response = await api.get(API_PATHS.dispatchDetail(tripId));
      detail = response.data || null;
    } catch {
      detail = null;
    }

    const mergedTrip = buildRouteSummary({
      ...(selectedRoute || {}),
      ...(detail || {}),
      id: tripId,
      trip_id: tripId,
      vehicle: detail?.vehicle || selectedRoute?.vehicle,
      vehicle_id: detail?.vehicle?.id || selectedRoute?.vehicle_id,
      stops:
        Array.isArray(detail?.stops) && detail.stops.length
          ? detail.stops
          : selectedRoute?.stops,
      otp: null,
    });

    dispatch(setDriverActiveTrip(mergedTrip));
    dispatch(setStep(STEPS.LIVE));
  };

  const handleEndRide = async () => {
    const tripId = activeTrip?.id || activeRide?.tripId;
    if (!tripId || endingRide) return;

    setEndingRide(true);
    try {
      await api.patch(API_PATHS.dispatchComplete(tripId));
    } catch {
      // Completion is retried implicitly by the health check; still show the summary.
    }

    const [fareResponse, earningsResponse] = await Promise.allSettled([
      api.get(RIDE_FARE(tripId)),
      api.get(RIDE_EARNINGS_TODAY),
    ]);

    const farePayload =
      fareResponse.status === "fulfilled"
        ? fareResponse.value.data?.data ?? fareResponse.value.data
        : null;
    const earningsPayload =
      earningsResponse.status === "fulfilled" ? earningsResponse.value.data : null;

    setRideResult({
      tripId,
      ride: activeRide,
      route: selectedRoute,
      fare: farePayload && farePayload.success !== false ? farePayload : null,
      earnings:
        earningsPayload && !earningsPayload.detail && earningsPayload.success !== false
          ? earningsPayload
          : null,
      distanceText: activeTrip?.distanceText || null,
      durationText: activeTrip?.durationText || null,
      completedAtLabel: new Date().toLocaleString("en-IN", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
    });

    dispatch(setDriverActiveTrip(null));
    dispatch(setActiveRide(null));
    dispatch(setDriverStatus("idle"));
    dispatch(setStep(STEPS.COMPLETE));
    setShowEndConfirm(false);
    setEndingRide(false);
  };

  const handleNextRide = () => {
    setRideResult(null);
    dispatch(resetDriverState());
  };

  const handleBackHome = () => {
    setRideResult(null);
    dispatch(resetDriverState());
    navigate("/");
  };

  if (currentStep === STEPS.COMPLETE) {
    if (!rideResult) {
      return (
        <DriverTripComplete
          result={{ ride: activeRide, route: selectedRoute }}
          onNextRide={handleNextRide}
          onBackHome={handleBackHome}
        />
      );
    }
    return (
      <DriverTripComplete
        result={rideResult}
        onNextRide={handleNextRide}
        onBackHome={handleBackHome}
      />
    );
  }

  if (currentStep === STEPS.PICKUP) {
    if (!activeRide?.tripId) return null;
    return (
      <DriverPickup
        ride={activeRide}
        route={selectedRoute}
        onBack={handlePickupBack}
        onArrived={() => dispatch(setStep(STEPS.OTP))}
      />
    );
  }

  if (currentStep === STEPS.OTP) {
    if (!activeRide?.tripId) return null;
    return (
      <DriverOtpEntry
        ride={activeRide}
        route={selectedRoute}
        onBack={() => dispatch(setStep(STEPS.PICKUP))}
        onVerified={handleVerified}
      />
    );
  }

  const buddyRadar = (
    <DriverBuddyRadar
      route={selectedRoute}
      onAccept={handleAcceptRide}
      onSkip={handleSkipRide}
      onBack={() => dispatch(setStep(STEPS.ROUTES))}
    />
  );

  if (currentStep === STEPS.RADAR) return buddyRadar;

  if (currentStep === STEPS.PREFLIGHT) {
    return (
      <div className="relative min-h-screen">
        {buddyRadar}
        <DriverPreRideCheck onComplete={() => dispatch(setStep(STEPS.RADAR))} />
      </div>
    );
  }

  if (currentStep === STEPS.LIVE) {
    return (
      <div className="relative min-h-screen lg:h-[calc(100vh-72px)] lg:min-h-0">
        <DriverLiveTracking
          activeTrip={activeTrip}
          onBack={() => dispatch(setStep(STEPS.RADAR))}
        />

        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          disabled={endingRide}
          className="fixed bottom-4 right-4 z-[6000] flex h-14 items-center justify-center gap-2 rounded-vayy bg-[#ef4444] px-6 text-[15px] font-extrabold text-white shadow-[0_14px_34px_rgba(239,68,68,0.35)] transition hover:bg-[#dc2626] disabled:opacity-70"
        >
          <CircleStop size={18} strokeWidth={2.6} />
          End Ride
        </button>

        {showEndConfirm && (
          <div className="fixed inset-0 z-[6500] flex items-end justify-center bg-slate-950/45 px-4 pb-6 backdrop-blur-[2px] sm:items-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fef2f2]">
                <CircleStop size={22} className="text-[#ef4444]" />
              </div>
              <h2 className="mt-4 text-[19px] font-black text-[#111827]">End this ride?</h2>
              <p className="mt-2 text-[14px] font-medium text-[#6b7280]">
                The trip will be completed, fare settled and your earnings updated.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleEndRide}
                  disabled={endingRide}
                  className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-vayy bg-[#ef4444] px-5 text-[15px] font-extrabold text-white transition hover:bg-[#dc2626] disabled:opacity-70"
                >
                  {endingRide ? "Ending…" : "End Ride"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEndConfirm(false)}
                  disabled={endingRide}
                  className="min-h-[52px] rounded-vayy border border-[#e5e7eb] bg-white px-5 text-[15px] font-extrabold text-[#6b7280]"
                >
                  Keep riding
                </button>
              </div>
            </div>
          </div>
        )}

        {endingRide && (
          <div className="absolute inset-0 z-[7000] flex items-center justify-center bg-slate-950/40 backdrop-blur-[2px]">
            <div className="flex items-center gap-4 rounded-2xl bg-white px-6 py-4 shadow-2xl">
              <LoaderCircle size={22} className="animate-spin text-[#009849]" />
              <span className="text-sm font-bold text-slate-800">Completing ride…</span>
            </div>
          </div>
        )}

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
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
        error={routeError}
        onBack={() => {
          setRouteError("");
          dispatch(setDriverError(null));
          dispatch(setStep(STEPS.PLANNER));
        }}
        onSelectRoute={handleSelectRoute}
      />
    );
  }

  // Recover to a usable home screen if stale persisted state contains a
  // step that this build no longer supports.
  return (
    <DriverTripPlanner
      initialSource={source}
      initialDestination={destination}
      loading={loadingRoutes}
      onNext={handlePlannerNext}
    />
  );
}
