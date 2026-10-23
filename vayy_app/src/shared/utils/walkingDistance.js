const WALKING_SPEED_MPS = 1.33; // ~4.8 km/h average walking speed

// Seconds -> human readable "45 sec" / "12 min" / "1 hr 20 min".
function formatDuration(seconds) {
  const total = Math.max(1, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total} sec`;
  if (total < 3600) return `${Math.ceil(total / 60)} min`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

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
  if (meters == null || !Number.isFinite(Number(meters))) return "--";
  const value = Number(meters);
  if (value < 1000) return `${Math.round(value)}m`;
  return `${(value / 1000).toFixed(1)} km`;
}

// Walk duration as "4 min" / "45 sec" / "1 hr 20 min" (no "walk" suffix).
export function walkingTimeValue(meters) {
  if (meters == null || !Number.isFinite(Number(meters))) return "--";
  return formatDuration(Number(meters) / WALKING_SPEED_MPS);
}

export function walkingTimeText(meters) {
  if (meters == null || !Number.isFinite(Number(meters))) return "-- min walk";
  return `${walkingTimeValue(meters)} walk`;
}

export function walkingDistanceText(meters) {
  return `${formatDistance(meters)} · ${walkingTimeText(meters)}`;
}
