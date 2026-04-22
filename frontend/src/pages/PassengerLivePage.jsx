import React from "react";
import { useNavigate } from "react-router-dom";
import PassengerFlow from "../features/passenger/components/PassengerFlow";

export default function PassengerLivePage() {
  const navigate = useNavigate();

  return (
    <PassengerFlow
      onBackToDashboard={() => navigate("/")}
    />
  );
}