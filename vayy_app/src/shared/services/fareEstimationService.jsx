import api, { normalizeApiError } from "../lib/api";
import { RIDE } from "../../constants";

export const getRideEstimate = async (pickupLat, pickupLng, dropLat, dropLng, vehicleType) => {
  try {
    const response = await api.post(RIDE.estimate, {
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      drop_lat: dropLat,
      drop_lng: dropLng,
      vehicle_type: vehicleType,
    });
    return response.data?.data || response.data;
  } catch (error) {
    throw normalizeApiError(error, "Unable to get fare estimate.");
  }
};

export const calculateFare = (distanceKm, vehicleType) => {
  const baseFares = {
    auto: 30,
    bike: 20,
  };
  const perKmRates = {
    auto: 10,
    bike: 5,
  };

  const baseFare = baseFares[vehicleType] || 50;
  const perKmRate = perKmRates[vehicleType] || 15;
  return Math.round(baseFare + distanceKm * perKmRate);
};

export const formatDurationMinutes = (seconds) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const formatDistanceKm = (meters) => {
  const km = meters / 1000;
  return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`;
};

export default {
  getRideEstimate,
  calculateFare,
  formatDurationMinutes,
  formatDistanceKm,
};
