import React from "react";
import DriverFlow from "../driver/components/DriverFlow";

// Thin wrapper (mirrors PassengerLivePage): the flow orchestrator owns every
// step. Route + role guard stay in routes/routeConfig.jsx.
export default function DriverLivePage() {
  return <DriverFlow />;
}
