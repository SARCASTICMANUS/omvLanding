const WALKING_SPEED_MPS = 1.4; // ~5 km/h average walking speed

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function walkingTimeText(meters) {
  const minutes = Math.ceil(meters / WALKING_SPEED_MPS / 60);
  return `${minutes} min walk`;
}

export function walkingDistanceText(meters) {
  return `${formatDistance(meters)} · ${walkingTimeText(meters)}`;
}
