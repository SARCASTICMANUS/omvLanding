import React, { useState } from "react";
import PassengerTripPlanner from "./PassengerTripPlanner";
import PassengerRouteList from "./PassengerRouteList";
import PassengerStopsTimeline from "./PassengerStopsTimeline";
import PassengerLiveTracking from "./PassengerLiveTracking";
import { passengerTrips as passengerData } from "../../../mock/passengerData";

const STEPS = {
  PLANNER: "planner",
  ROUTE_LIST: "route-list",
  STOPS: "stops",
  LIVE: "live",
};

export default function PassengerFlow({ onBackToDashboard }) {
  const [currentStep, setCurrentStep] = useState(STEPS.PLANNER);
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const hasValidCoords = (point) =>
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon);

  const normalizeText = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  // ✅ USE passengerData HERE
  const fetchFilteredTrips = async (from, to) => {
    if (!hasValidCoords(from) || !hasValidCoords(to)) {
      console.error("Invalid pickup/drop coordinates", { from, to });
      return [];
    }

    await new Promise((resolve) => setTimeout(resolve, 400));

    const fromName = normalizeText(from?.name || from?.display_name);
    const toName = normalizeText(to?.name || to?.display_name);

    const filtered = passengerData.filter((trip) => {
      const tripPickup = normalizeText(trip.pickup_name);
      const tripDestination = normalizeText(trip.destination_name);

      const pickupMatch = fromName
        ? tripPickup.includes(fromName) || fromName.includes(tripPickup)
        : true;

      const destinationMatch = toName
        ? tripDestination.includes(toName) ||
          toName.includes(tripDestination)
        : true;

      return pickupMatch && destinationMatch; // ✅ FIXED
    });

    return filtered;
  };

  const handlePlannerNext = async ({ from, to }) => {
    setPickup(from);
    setDestination(to);
    setSelectedTrip(null);
    setFilteredTrips([]);

    try {
      setLoadingRoutes(true);
      const trips = await fetchFilteredTrips(from, to);
      setFilteredTrips(trips);
      setCurrentStep(STEPS.ROUTE_LIST);
    } catch (error) {
      console.error("Failed to load trips", error);
      setFilteredTrips([]);
      setCurrentStep(STEPS.ROUTE_LIST);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleChooseRoute = (trip) => {
    setSelectedTrip(trip);
    setCurrentStep(STEPS.STOPS);
  };

  const handleTrackNow = () => {
    if (!selectedTrip) return;
    setCurrentStep(STEPS.LIVE);
  };

  const handleUpdatePickup = (nextPickup) => {
    setPickup(nextPickup);
    setSelectedTrip(null);
  };

  const handleUpdateDestination = (nextDestination) => {
    setDestination(nextDestination);
    setSelectedTrip(null);
  };

  const handleReSearchRoutes = async () => {
    if (!hasValidCoords(pickup) || !hasValidCoords(destination)) return;

    try {
      setLoadingRoutes(true);
      setSelectedTrip(null);

      const trips = await fetchFilteredTrips(pickup, destination);
      setFilteredTrips(trips);
      setCurrentStep(STEPS.ROUTE_LIST);
    } catch (error) {
      console.error("Failed to refresh trips", error);
      setFilteredTrips([]);
    } finally {
      setLoadingRoutes(false);
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
        onBack={() => setCurrentStep(STEPS.PLANNER)}
        onChooseRoute={handleChooseRoute}
        onUpdatePickup={handleUpdatePickup}
        onUpdateDestination={handleUpdateDestination}
        onReSearchRoutes={handleReSearchRoutes}
      />
    );
  }

  if (currentStep === STEPS.STOPS) {
    return (
      <PassengerStopsTimeline
        selectedTrip={selectedTrip}
        pickup={pickup}
        destination={destination}
        onBack={() => setCurrentStep(STEPS.ROUTE_LIST)}
        onTrackNow={handleTrackNow}
        onEditRoute={() => setCurrentStep(STEPS.ROUTE_LIST)}
      />
    );
  }

  if (currentStep === STEPS.LIVE) {
    return (
      <PassengerLiveTracking
        selectedTrip={selectedTrip}
        pickup={pickup}
        destination={destination}
        onBack={() => setCurrentStep(STEPS.STOPS)}
        onUpdatePickup={handleUpdatePickup}
        onUpdateDestination={handleUpdateDestination}
        onRefreshRoutes={handleReSearchRoutes}
      />
    );
  }

  return null;
}