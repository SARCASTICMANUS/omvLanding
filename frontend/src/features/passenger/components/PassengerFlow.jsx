import React, { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import PassengerTripPlanner from "./PassengerTripPlanner";
import PassengerRouteList from "./PassengerRouteList";
import PassengerPreRide from "./PassengerPreRide";
import PassengerSearching from "./PassengerSearching";
import PassengerRiderPopup from "./PassengerRiderPopup";
import PassengerRideComplete from "./PassengerRideComplete";
import PassengerLiveTracking from "./PassengerLiveTracking";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import {
  fetchDynamicRoutes,
  isDynamicRouteCreationEnabled,
} from "../../../services/routes/routeProvider";
import { useSocketSubscription } from "../../../hooks/useSocketSubscription";
import {
  setJourneyStep,
  setJourneyPoints,
  setFilteredTrips,
  setSelectedTrip,
  setPickupPoint,
  setDestinationPoint,
  setJourneyLoading,
} from "../../../redux/slices/journeySlice";

const STEPS = {
  PLANNER: "planner",
  ROUTE_LIST: "route-list",
  LIVE: "live",
};

const STAGES = {
  PRERIDE: "preride",
  SEARCHING: "searching",
  MATCHED: "matched",
  ACTIVE: "active",
  COMPLETE: "complete",
};

const EMPTY_BOOKING = {
  mode: "bike",
  estimateFare: null,
  finalFare: null,
  distanceKm: null,
  durationMin: null,
  requestId: null,
  tripId: null,
  driverName: "",
  vehicleNumber: "",
  driverRating: null,
  otp: "",
  etaMin: null,
  routeName: "",
  pickupName: "",
  dropName: "",
  status: "",
};

function getAccessToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("access_token");
}

function errorText(error, fallback) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    fallback
  );
}

export default function PassengerFlow({ onBackToDashboard }) {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "auto" ? "auto" : "bike";
  const {
    currentStep,
    pickup,
    destination,
    filteredTrips,
    selectedTrip,
    loading: loadingRoutes,
  } = useSelector((state) => state.journey);

  const [stage, setStage] = useState(null);
  const [booking, setBooking] = useState(EMPTY_BOOKING);
  const [cancelling, setCancelling] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");
  const [routeError, setRouteError] = useState("");
  const settledRef = useRef(false);

  /* City and vehicle type come from the existing profile / URL mode — no second
     location-selection or config state is introduced. */
  const user = useSelector((state) => state.auth?.user);

  const hasValidCoords = (point) =>
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon);

  const normalizeTrips = (data) => {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== "object") return [];

    if (Array.isArray(data.active_trips)) return data.active_trips;
    if (Array.isArray(data.trips)) return data.trips;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.routes)) return data.routes;
    if (Array.isArray(data.data)) return data.data;

    return [];
  };

  const fetchFilteredTrips = async (from, to) => {
    if (!hasValidCoords(from) || !hasValidCoords(to)) {
      console.error("Invalid pickup/drop coordinates", { from, to });
      return [];
    }

    // ==========================================================================
    // DYNAMIC ROUTE CREATION — ACTIVE (DYNAMIC_ROUTE_CREATION_ENABLED = true)
    //
    // The origin/destination chosen in the existing planner are posted to the
    // backend Dynamic Route API. The generated response is mapped by
    // normalizeDynamicRoute() into the same shape the existing Route Card and
    // the existing pre-ride / searching steps already consume, so only the data
    // source changed.
    // ==========================================================================
    if (isDynamicRouteCreationEnabled()) {
      const { routes } = await fetchDynamicRoutes({
        audience: "passenger",
        origin: from,
        destination: to,
        cityId: user?.city ?? null,
        vehicleType: mode,
      });
      return routes;
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
    try {
      const response = await api.get(API_PATHS.transport.routeSearchByLocation, {
        params: {
          origin_lat: from.lat,
          origin_lng: from.lon,
          dest_lat: to.lat,
          dest_lng: to.lon,
        },
      });
      return normalizeTrips(response.data).filter((trip) => {
        const type = String(trip?.vehicle_type || trip?.vehicle?.vehicle_type || "").toLowerCase();
        return !type.includes("auto");
      });
    } catch (error) {
      console.error("Failed to fetch filtered trips", error);
      return [];
    }
  };

  const handlePlannerNext = async ({ from, to }) => {
    dispatch(setJourneyPoints({ pickup: from, destination: to }));

    // Save to recent searches (parity with mobile PassengerTripPlanner.handleNext)
    api.post(API_PATHS.auth.recentSearches, {
      pickup_name: from?.name || from?.display_name || "",
      pickup_lat: from?.lat || 0,
      pickup_lon: from?.lon || 0,
      destination_name: to?.name || to?.display_name || "",
      destination_lat: to?.lat || 0,
      destination_lon: to?.lon || 0,
    }).catch(err => console.error("Failed to save recent search", err));

    flushSync(() => {
      dispatch(setJourneyLoading(true));
    });

    try {
      setRouteError("");
      const trips = await fetchFilteredTrips(from, to);
      dispatch(setFilteredTrips(trips));
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));
    } catch (error) {
      console.error("Failed to load trips", error);
      dispatch(setFilteredTrips([]));
      // Sanitised copy only — never surface raw backend/OSRM messages.
      setRouteError(
        error?.isDynamicRouteError
          ? error.message
          : "We couldn't load routes for this journey.",
      );
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));
    } finally {
      dispatch(setJourneyLoading(false));
    }
  };

  const resetBooking = useCallback((mode) => {
    setEndError("");
    setBooking({ ...EMPTY_BOOKING, mode: mode || EMPTY_BOOKING.mode });
  }, []);

  const handleChooseRoute = (trip) => {
    dispatch(setSelectedTrip(trip));
    resetBooking("bike");
    settledRef.current = false;
    setStage(STAGES.PRERIDE);
  };

  const handleUpdatePickup = (nextPickup) => {
    dispatch(setPickupPoint(nextPickup));
  };

  const handleUpdateDestination = (nextDestination) => {
    dispatch(setDestinationPoint(nextDestination));
  };

  const handleReSearchRoutes = async () => {
    if (!hasValidCoords(pickup) || !hasValidCoords(destination)) return;

    try {
      dispatch(setJourneyLoading(true));
      setRouteError("");
      const trips = await fetchFilteredTrips(pickup, destination);
      dispatch(setFilteredTrips(trips));
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));
    } catch (error) {
      console.error("Failed to refresh trips", error);
      dispatch(setFilteredTrips([]));
      setRouteError(
        error?.isDynamicRouteError
          ? error.message
          : "We couldn't load routes for this journey.",
      );
    } finally {
      dispatch(setJourneyLoading(false));
    }
  };

  const handleEstimate = useCallback((data) => {
    setBooking((prev) => ({
      ...prev,
      estimateFare: data?.estimated_fare ?? prev.estimateFare,
      distanceKm: data?.distance_km ?? prev.distanceKm,
      durationMin: data?.duration_minutes ?? prev.durationMin,
    }));
  }, []);

  const handleMatched = useCallback(
    (payload) => {
      if (settledRef.current) return;
      const tripId = payload.trip_id || payload.id;
      if (!tripId) return;

      setBooking((prev) => ({
        ...prev,
        tripId,
        requestId: payload.request_id || prev.requestId,
        driverName: payload.driver_name || prev.driverName,
        vehicleNumber: payload.vehicle_number || prev.vehicleNumber,
        driverRating: payload.driver_rating ?? prev.driverRating,
        otp: payload.otp || prev.otp,
        distanceKm: payload.distance_km ?? prev.distanceKm,
        etaMin: payload.eta ?? prev.etaMin,
        routeName: payload.route_name || prev.routeName,
        pickupName: payload.pickup_name || prev.pickupName,
        dropName: payload.drop_name || prev.dropName,
        status: payload.status || "accepted",
      }));
      setEndError("");
      setStage(STAGES.MATCHED);
      dispatch(setJourneyStep(STEPS.LIVE));
    },
    [dispatch],
  );

  const settleTrip = useCallback(
    (finalFare) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setEndError("");
      setBooking((prev) => ({
        ...prev,
        status: "completed",
        finalFare: finalFare ?? prev.finalFare ?? prev.estimateFare ?? null,
      }));
      setStage(STAGES.COMPLETE);
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));

      const tripId = booking.tripId;
      if (finalFare == null && tripId) {
        api
          .get(API_PATHS.operations.tripDetail(tripId))
          .then((response) => {
            const data = response.data?.data ?? response.data ?? {};
            const fare = data.total_fare ?? null;
            if (fare == null) return;
            setBooking((prev) => ({ ...prev, finalFare: fare }));
          })
          .catch(() => null);
      }
    },
    [dispatch, booking.tripId],
  );

  const handleTripStatus = useCallback(
    (status) => {
      if (status === "completed") {
        settleTrip(null);
        return;
      }
      if (status === "cancelled") {
        if (settledRef.current) return;
        settledRef.current = true;
        resetBooking(booking.mode);
        setStage(null);
        dispatch(setJourneyStep(STEPS.ROUTE_LIST));
        return;
      }
      setBooking((prev) => (prev.status === status ? prev : { ...prev, status }));
    },
    [settleTrip, resetBooking, booking.mode, dispatch],
  );

  const dispatchSocket = useSocketSubscription({
    key: `passenger-dispatch-${booking.tripId}`,
    path: booking.tripId ? `/ws/dispatch/${booking.tripId}/?token=${getAccessToken()}` : null,
    enabled: Boolean(booking.tripId),
    onMessage: (message) => {
      if (!message) return;

      if (message.driver_name || message.vehicle_number || message.otp) {
        setBooking((prev) => ({
          ...prev,
          driverName: message.driver_name || prev.driverName,
          vehicleNumber: message.vehicle_number || prev.vehicleNumber,
          driverRating: message.driver_rating ?? prev.driverRating,
          otp: message.otp || prev.otp,
        }));
      }

      if (message.status) {
        handleTripStatus(message.status);
      }
    },
  });

  const handleEndRide = useCallback(async () => {
    if (!booking.tripId || ending) return;
    setEnding(true);
    setEndError("");
    try {
      const response = await api.patch(API_PATHS.operations.dispatchComplete(booking.tripId));
      const data = response.data?.data ?? response.data ?? {};
      settleTrip(data.total_fare ?? null);
    } catch (error) {
      setEndError(errorText(error, "We couldn't end the ride. Please try again."));
    } finally {
      setEnding(false);
    }
  }, [booking.tripId, ending, settleTrip]);

  const handleCancelRide = useCallback(async () => {
    if (!booking.tripId || cancelling) return;
    setCancelling(true);
    await api
      .post(API_PATHS.operations.dispatchCancel(booking.tripId))
      .catch(() => null);
    setCancelling(false);
    if (settledRef.current) return;
    settledRef.current = true;
    resetBooking(booking.mode);
    setStage(null);
    dispatch(setJourneyStep(STEPS.ROUTE_LIST));
  }, [booking.tripId, cancelling, booking.mode, resetBooking, dispatch]);

  const handleLiveBack = useCallback(() => {
    if (booking.tripId) {
      setStage(STAGES.MATCHED);
      return;
    }
    setStage(null);
    dispatch(setJourneyStep(STEPS.ROUTE_LIST));
  }, [booking.tripId, dispatch]);

  const handleBookAnother = useCallback(() => {
    resetBooking(booking.mode);
    setStage(null);
    dispatch(setJourneyStep(STEPS.ROUTE_LIST));
  }, [resetBooking, booking.mode, dispatch]);

  const handleRideCompleteExit = useCallback(() => {
    resetBooking(booking.mode);
    setStage(null);
    dispatch(setJourneyStep(STEPS.PLANNER));
    onBackToDashboard?.();
  }, [resetBooking, booking.mode, dispatch, onBackToDashboard]);

  const step = currentStep === STEPS.LIVE && !booking.tripId ? STEPS.ROUTE_LIST : currentStep;

  if (mode === "auto") {
    return (
      <PassengerTripPlanner
        mode="auto"
        onBack={onBackToDashboard}
        onNext={handlePlannerNext}
        loading={loadingRoutes}
      />
    );
  }

  if (step === STEPS.PLANNER) {
    return (
      <PassengerTripPlanner
        mode={mode}
        onBack={onBackToDashboard}
        onNext={handlePlannerNext}
        loading={loadingRoutes}
      />
    );
  }

  if (step === STEPS.ROUTE_LIST && stage === null) {
    return (
      <PassengerRouteList
        pickup={pickup}
        destination={destination}
        trips={filteredTrips}
        loading={loadingRoutes}
        error={routeError}
        onBack={() => {
          setRouteError("");
          dispatch(setJourneyStep(STEPS.PLANNER));
        }}
        onChooseRoute={handleChooseRoute}
        onUpdatePickup={handleUpdatePickup}
        onUpdateDestination={handleUpdateDestination}
        onReSearchRoutes={handleReSearchRoutes}
      />
    );
  }

  if (step === STEPS.LIVE) {
    return (
      <div className="fixed inset-0 z-[500] overflow-hidden bg-vayy-canvas lg:top-[72px]">
        <PassengerLiveTracking
          tripId={booking.tripId}
          onBack={handleLiveBack}
          onTripStatus={handleTripStatus}
          rideStatus={booking.status}
          showEndRide={booking.status === "active" && Boolean(booking.tripId)}
          onEndRide={handleEndRide}
          ending={ending}
          endError={endError}
        />
        {stage === STAGES.MATCHED ? (
          <PassengerRiderPopup
            booking={booking}
            statusLabel={booking.status}
            live={dispatchSocket.status === "open"}
            cancelling={cancelling}
            onTrack={() => setStage(STAGES.ACTIVE)}
            onCancel={handleCancelRide}
          />
        ) : null}
      </div>
    );
  }

  if (stage === STAGES.COMPLETE) {
    return (
      <PassengerRideComplete
        booking={booking}
        onBookAnother={handleBookAnother}
        onBackToDashboard={handleRideCompleteExit}
      />
    );
  }

  if (stage === STAGES.SEARCHING) {
    return (
      <PassengerSearching
        selectedTrip={selectedTrip}
        pickup={pickup}
        destination={destination}
        onMatched={handleMatched}
        onBack={() => setStage(STAGES.PRERIDE)}
      />
    );
  }

  if (stage === STAGES.PRERIDE) {
    return (
      <PassengerPreRide
        selectedTrip={selectedTrip}
        pickup={pickup}
        destination={destination}
        onEstimate={handleEstimate}
        onBack={() => {
          setStage(null);
          dispatch(setJourneyStep(STEPS.ROUTE_LIST));
        }}
        onConfirm={() => setStage(STAGES.SEARCHING)}
      />
    );
  }

  return (
    <PassengerTripPlanner
      mode={mode}
      onBack={onBackToDashboard}
      onNext={handlePlannerNext}
      loading={loadingRoutes}
    />
  );
}
