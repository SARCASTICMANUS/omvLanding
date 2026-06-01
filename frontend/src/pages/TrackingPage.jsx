import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import PassengerLiveTracking from "../features/passenger/components/PassengerLiveTracking";

export default function TrackingPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();

  return (
    <PassengerLiveTracking 
      tripId={tripId} 
      onBack={() => navigate(-1)} 
    />
  );
}
