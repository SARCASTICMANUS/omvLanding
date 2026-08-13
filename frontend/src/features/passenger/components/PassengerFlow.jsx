import React from "react";
import { flushSync } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import PassengerTripPlanner from "./PassengerTripPlanner";
import PassengerRouteList from "./PassengerRouteList";
import PassengerStopsTimeline from "./PassengerStopsTimeline";
import PassengerLiveTracking from "./PassengerLiveTracking";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
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
  STOPS: "stops",
  LIVE: "live",
};

export default function PassengerFlow({ onBackToDashboard }) {
  const dispatch = useDispatch();
  const {
    currentStep,
    pickup,
    destination,
    filteredTrips,
    selectedTrip,
    loading: loadingRoutes,
  } = useSelector((state) => state.journey);

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

    try {
      const response = await api.get(API_PATHS.transport.routeSearchByLocation, {
        params: {
          origin_lat: from.lat,
          origin_lng: from.lon,
          dest_lat: to.lat,
          dest_lng: to.lon,
        },
      });
      return normalizeTrips(response.data);
    } catch (error) {
      console.error("Failed to fetch filtered trips", error);
      return [];
    }
  };

  const fetchAllTrips = async () => {
    try {
      const response = await api.get(API_PATHS.operations.trips);
      return normalizeTrips(response.data);
    } catch (error) {
      console.error("Failed to fetch all trips", error);
      return [];
    }
  };

  const handlePlannerNext = async ({ from, to }) => {
    dispatch(setJourneyPoints({ pickup: from, destination: to }));

    flushSync(() => {
      dispatch(setJourneyLoading(true));
    });

    try {
      const trips = await fetchFilteredTrips(from, to);
      dispatch(setFilteredTrips(trips));
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));
    } catch (error) {
      console.error("Failed to load trips", error);
      dispatch(setFilteredTrips([]));
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));
    } finally {
      dispatch(setJourneyLoading(false));
    }
  };

  const handleShowAllBuses = async () => {
    try {
      dispatch(setJourneyLoading(true));
      const allTrips = await fetchAllTrips();
      dispatch(setFilteredTrips(allTrips));
    } catch (error) {
      console.error("Failed to load all buses", error);
    } finally {
      dispatch(setJourneyLoading(false));
    }
  };

  const handleChooseRoute = (trip) => {
    dispatch(setSelectedTrip(trip));
    dispatch(setJourneyStep(STEPS.STOPS));
  };

  const handleTrackNow = () => {
    if (!selectedTrip) return;
    dispatch(setJourneyStep(STEPS.LIVE));
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
      const trips = await fetchFilteredTrips(pickup, destination);
      dispatch(setFilteredTrips(trips));
      dispatch(setJourneyStep(STEPS.ROUTE_LIST));
    } catch (error) {
      console.error("Failed to refresh trips", error);
      dispatch(setFilteredTrips([]));
    } finally {
      dispatch(setJourneyLoading(false));
    }
  };

  if (currentStep === STEPS.PLANNER) {
    return (
      <PassengerTripPlanner
        onBack={onBackToDashboard}
        onNext={handlePlannerNext}
        loading={loadingRoutes}
      />
    );
  }

  if (currentStep === STEPS.ROUTE_LIST) {
    return (
      <PassengerRouteList
        pickup={pickup}
        destination={destination}
        trips={filteredTrips}
        loading={loadingRoutes}
        onBack={() => dispatch(setJourneyStep(STEPS.PLANNER))}
        onChooseRoute={handleChooseRoute}
        onUpdatePickup={handleUpdatePickup}
        onUpdateDestination={handleUpdateDestination}
        onReSearchRoutes={handleReSearchRoutes}
        onShowAllBuses={handleShowAllBuses}
      />
    );
  }

  if (currentStep === STEPS.STOPS) {
    return (
      <PassengerStopsTimeline
        selectedTrip={selectedTrip}
        pickup={pickup}
        destination={destination}
        onBack={() => dispatch(setJourneyStep(STEPS.ROUTE_LIST))}
        onTrackNow={handleTrackNow}
        onEditRoute={() => dispatch(setJourneyStep(STEPS.ROUTE_LIST))}
      />
    );
  }

  if (currentStep === STEPS.LIVE) {
    return (
      <PassengerLiveTracking
        tripId={selectedTrip?.trip_id || selectedTrip?.id}
        pickup={pickup}
        destination={destination}
        onBack={() => dispatch(setJourneyStep(STEPS.STOPS))}
        onUpdatePickup={handleUpdatePickup}
        onUpdateDestination={handleUpdateDestination}
        onRefreshRoutes={handleReSearchRoutes}
      />
    );
  }

  return null;
}
