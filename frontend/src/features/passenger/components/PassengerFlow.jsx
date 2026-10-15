import React, { useCallback, useEffect, useRef, useState } from "react";
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

  const hasValidCoords = (point) =>
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon);

  const fetchFilteredTrips = async (from, to) => {
    if (!hasValidCoords(from) || !hasValidCoords(to)) {
      throw new Error("Pickup and destination coordinates are required.");
    }

    const response = await api.post(API_PATHS.tracking.corridorVehicles, {
      origin: { lat: from.lat, lng: from.lon },
      destination: { lat: to.lat, lng: to.lon },
      radius: 2000,
      limit: 20,
    });
    const data = response.data?.data ?? response.data ?? {};
    const path = Array.isArray(data.path) ? data.path : [];
    const routeGeometry = path.length > 1
      ? { type: "LineString", coordinates: path.map(([lat, lng]) => [lng, lat]) }
      : null;

    return (Array.isArray(data.vehicles) ? data.vehicles : [])
      .filter((vehicle) => !mode || vehicle.vehicle_type === mode)
      .map((vehicle) => {
        const board = vehicle.board_stop;
        const drop = vehicle.drop_stop;
        const segmentDistanceM = Number(vehicle.segment_distance_m);
        const etaSeconds = vehicle.eta_minutes == null ? null : Number(vehicle.eta_minutes) * 60;
        return {
          ...vehicle,
          id: vehicle.trip_id,
          trip_id: vehicle.trip_id,
          route_id: null,
          route_code: vehicle.vehicle_number,
          name: vehicle.driver_name || vehicle.vehicle_number,
          source_name: board?.name || from.name || from.display_name || "Pickup",
          destination_name: drop?.name || to.name || to.display_name || "Destination",
          origin: board?.name || from.name || from.display_name || "Pickup",
          destination: drop?.name || to.name || to.display_name || "Destination",
          pickup_stop: board ? { ...board, lon: board.lng, lat: Number(board.lat) } : null,
          dropoff_stop: drop ? { ...drop, lon: drop.lng, lat: Number(drop.lat) } : null,
          fare: vehicle.estimated_fare ?? null,
          distance_km: Number.isFinite(segmentDistanceM) ? Number((segmentDistanceM / 1000).toFixed(2)) : null,
          total_distance_meters: Number.isFinite(segmentDistanceM) ? segmentDistanceM : null,
          eta_seconds: Number.isFinite(etaSeconds) ? etaSeconds : null,
          stops: Array.isArray(vehicle.upcoming_stops) ? vehicle.upcoming_stops : [],
          route_geometry: routeGeometry,
          is_live_journey: true,
        };
      });
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

  // Keep the driver cards live without remounting or changing their UI. The
  // endpoint reads live coordinates/progress from Redis and cached OSRM geometry.
  useEffect(() => {
    if (
      currentStep !== STEPS.ROUTE_LIST || stage !== null ||
      !hasValidCoords(pickup) || !hasValidCoords(destination)
    ) return undefined;

    let alive = true;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const trips = await fetchFilteredTrips(pickup, destination);
        if (alive) dispatch(setFilteredTrips(trips));
      } catch {
        // Keep the last successful list if a refresh fails transiently.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(refresh, 15000);
    return () => { alive = false; clearInterval(timer); };
    // fetchFilteredTrips only depends on the coordinates and mode listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, stage, pickup?.lat, pickup?.lon, destination?.lat, destination?.lon, mode, dispatch]);

  const journeySearchInFlightRef = useRef(false);
  useSocketSubscription({
    key: "passenger-journey-search",
    path: `/ws/tracking/journey-search/?token=${getAccessToken()}`,
    enabled: currentStep === STEPS.ROUTE_LIST && stage === null,
    onMessage: async (message) => {
      if (message?.type !== "journey_search_update" || journeySearchInFlightRef.current) return;
      if (!hasValidCoords(pickup) || !hasValidCoords(destination)) return;
      journeySearchInFlightRef.current = true;
      try {
        const trips = await fetchFilteredTrips(pickup, destination);
        dispatch(setFilteredTrips(trips));
      } catch {
        // Keep last successful cards during a transient failure.
      } finally {
        journeySearchInFlightRef.current = false;
      }
    },
  });

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
        boardingRequestId: payload.boarding_request_id || prev.boardingRequestId || null,
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
        finalFare: finalFare ?? prev.finalFare ?? null,
      }));
      setStage(STAGES.COMPLETE);
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));

      const tripId = booking.tripId;
      if (finalFare == null && tripId && !booking.boardingRequestId) {
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
    [dispatch, booking.tripId, booking.boardingRequestId],
  );

  const handleTripStatus = useCallback(
    (status, message = null) => {
      if (message?.type === "passenger_segment_completed" && message.boarding_request_id !== booking.boardingRequestId) return;
      if (message?.type === "passenger_arrived" && message.boarding_request_id !== booking.boardingRequestId) return;
      if (message?.type === "trip_completed" && Array.isArray(message.passengers)) {
        const ownSegment = message.passengers.find((item) => item.boarding_request_id === booking.boardingRequestId);
        if (booking.boardingRequestId && !ownSegment) return;
        settleTrip(ownSegment?.fare ?? null);
        return;
      }
      if (status === "completed") {
        settleTrip(message?.fare ?? null);
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
    [settleTrip, resetBooking, booking.mode, booking.boardingRequestId, dispatch],
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
        handleTripStatus(message.status, message);
      }
    },
  });

  const handleEndRide = useCallback(async () => {
    if (!booking.tripId || ending) return;
    setEnding(true);
    setEndError("");
    try {
      const response = await api.patch(API_PATHS.operations.dispatchComplete(booking.tripId), {
        ...(booking.boardingRequestId ? { boarding_request_id: booking.boardingRequestId } : {}),
      });
      const data = response.data?.data ?? response.data ?? {};
      if (data.status === "partially_settled") throw new Error("Passenger fare could not be settled. Please retry.");
      settleTrip(data.fare ?? data.total_fare ?? null);
    } catch (error) {
      setEndError(errorText(error, "We couldn't end the ride. Please try again."));
    } finally {
      setEnding(false);
    }
  }, [booking.tripId, booking.boardingRequestId, ending, settleTrip]);

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
