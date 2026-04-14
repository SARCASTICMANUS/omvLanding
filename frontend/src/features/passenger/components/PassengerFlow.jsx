import React, { useState } from "react";
import api from "../../../lib/api";
import PassengerTripPlanner from "./PassengerTripPlanner";
import PassengerRouteList from "./PassengerRouteList";
import PassengerLiveTracking from "./PassengerLiveTracking";

const STEPS = {
  PLANNER: "planner",
  ROUTE_LIST: "route-list",
  LIVE: "live",
};

export default function PassengerFlow({ onBackToDashboard }) {
  const [currentStep, setCurrentStep] = useState(STEPS.PLANNER);

  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);

  const [loadingRoutes, setLoadingRoutes] = useState(false);

  const handlePlannerNext = async ({ from, to }) => {
    setPickup(from);
    setDestination(to);
    setSelectedTrip(null);
    setFilteredTrips([]);

    try {
      setLoadingRoutes(true);

      const res = await api.post("/api/passenger/filtered-trips/", {
        pickup: { lat: from.lat, lon: from.lon },
        destination: { lat: to.lat, lon: to.lon },
      });

      setFilteredTrips(Array.isArray(res.data) ? res.data : []);
      setCurrentStep(STEPS.ROUTE_LIST);
    } catch (error) {
      console.error("Failed to fetch filtered trips", error);
      setFilteredTrips([]);
      setCurrentStep(STEPS.ROUTE_LIST);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleChooseRoute = (trip) => {
    setSelectedTrip(trip);
    setCurrentStep(STEPS.LIVE);
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
      />
    );
  }

  if (currentStep === STEPS.LIVE) {
    return (
      <PassengerLiveTracking
        selectedTrip={selectedTrip}
        pickup={pickup}
        destination={destination}
        onBack={() => setCurrentStep(STEPS.ROUTE_LIST)}
      />
    );
  }

  return null;
}