export const RIDE_REQUEST_TTL_SECONDS = 45;

const asPlace = (value, fallback) => {
  if (typeof value === "string") return value || fallback;
  if (value && typeof value === "object") {
    return value.name || value.display_name || value.label || fallback;
  }
  return fallback;
};

const pickId = (source) => {
  if (!source || typeof source !== "object") return null;
  const raw = source.request_id || source.dispatch_id || source.trip_id || source.id;
  return raw === undefined || raw === null || raw === "" ? null : String(raw);
};

export const buildRideAvatar = (name) => {
  const initials = String(name || "P")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "P";
};

export const formatKm = (km) => {
  const value = Number(km);
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(2)} km`;
};

const resolveSource = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  if (payload.dispatch && typeof payload.dispatch === "object") return payload.dispatch;
  if (payload.request && typeof payload.request === "object") return payload.request;
  if (payload.ride && typeof payload.ride === "object") return payload.ride;
  if (payload.type && !payload.request_id && !payload.trip_id && !payload.id) return null;
  return payload;
};

export const isRideDismissal = (payload) => {
  const type = payload?.type;
  if (!type) return false;
  return (
    type === "request_cancelled" ||
    type === "request_expired" ||
    type === "dispatch_cancelled" ||
    type === "ride_cancelled"
  );
};

export const normalizeRidePayload = (payload) => {
  const type = payload?.type;
  const isKnownStream =
    !type ||
    type === "new_dispatch_request" ||
    type === "ride_request" ||
    type === "ride_update" ||
    type === "dispatch_request" ||
    type === "ride_offer";

  if (!isKnownStream) return null;

  const raw = resolveSource(payload);
  if (!raw) return null;

  const tripId = raw.trip_id ? String(raw.trip_id) : null;
  const requestId = raw.request_id ? String(raw.request_id) : null;
  const dispatchId = pickId(raw);
  if (!tripId && !requestId && !dispatchId) return null;

  const name = asPlace(raw.passenger_name || raw.user_name || raw.passenger, "Passenger");

  return {
    key: requestId || tripId || dispatchId,
    requestId,
    tripId,
    dispatchId: tripId || dispatchId,
    name,
    rating: raw.passenger_rating ?? raw.rating ?? null,
    trips: Number(raw.passenger_trips ?? raw.trips ?? 0) || 0,
    pickup: asPlace(raw.pickup_name || raw.pickup, "Pickup"),
    drop: asPlace(raw.drop_name || raw.drop || raw.destination, "Destination"),
    pickupLat: raw.pickup_lat ?? raw.pickup_latitude ?? null,
    pickupLng: raw.pickup_lng ?? raw.pickup_longitude ?? null,
    dropLat: raw.drop_lat ?? raw.drop_latitude ?? null,
    dropLng: raw.drop_lng ?? raw.drop_longitude ?? null,
    distanceKm: raw.distance_km ?? raw.distance ?? null,
    duration: raw.duration || raw.duration_min || null,
    fareAmount: raw.fare ?? raw.fare_amount ?? null,
    eta: raw.eta ?? null,
    otp: raw.otp || null,
    routeId: raw.route_id || null,
    routeName: raw.route_name || null,
    avatar: buildRideAvatar(name),
    receivedAt: Date.now(),
  };
};

export const mergeRideAccept = (ride, data) => ({
  ...ride,
  tripId: data?.trip_id || data?.id || ride.tripId || ride.dispatchId,
  dispatchId: data?.trip_id || data?.id || ride.dispatchId,
  otp: data?.otp || ride.otp || null,
});
