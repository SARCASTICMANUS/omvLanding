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

export const FARE_RATES = {
  auto: { baseFare: 30, perKmRate: 10 },
  bike: { baseFare: 20, perKmRate: 5 },
  default: { baseFare: 50, perKmRate: 15 },
};

const getRate = (vehicleType) => FARE_RATES[vehicleType] || FARE_RATES.default;

export const calculateFare = (distanceKm, vehicleType) => {
  const { baseFare, perKmRate } = getRate(vehicleType);
  return Math.round(baseFare + distanceKm * perKmRate);
};

export const calculateFareBreakdown = (distanceKm, vehicleType) => {
  const { baseFare, perKmRate } = getRate(vehicleType);
  const distanceFare = Math.round(Number(distanceKm) * perKmRate);
  return {
    baseFare,
    perKmRate,
    distanceFare,
    totalFare: baseFare + distanceFare,
  };
};

export const buildFareBreakdown = ({ distanceKm = 0, vehicleType = "bike", fareData = null, totalFare = null }) => {
  const baseFare = fareData?.base_fare != null ? Number(fareData.base_fare) : null;
  const perKmRate = fareData?.per_km_charge != null ? Number(fareData.per_km_charge) : null;
  const distanceFare = fareData?.distance_fare != null ? Number(fareData.distance_fare) : null;
  const total = totalFare != null
    ? Number(totalFare)
    : (fareData?.total_fare != null ? Number(fareData.total_fare) : null);

  if (baseFare != null && perKmRate != null) {
    return {
      baseFare,
      perKmRate,
      distanceFare: distanceFare != null ? distanceFare : Math.round(Number(distanceKm) * perKmRate),
      totalFare: total != null ? total : baseFare + Math.round(Number(distanceKm) * perKmRate),
    };
  }
  return calculateFareBreakdown(distanceKm, vehicleType);
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
  calculateFareBreakdown,
  buildFareBreakdown,
  FARE_RATES,
  formatDurationMinutes,
  formatDistanceKm,
};
