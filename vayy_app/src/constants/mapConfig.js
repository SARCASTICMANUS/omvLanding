// Neutral fallback for when a device location and an explicit map coordinate are
// both unavailable. Map wrappers attempt to use an already-authorized device fix
// before showing this fallback; do not bake one pilot city into global map state.
export const DEFAULT_CENTER = { latitude: 22.9734, longitude: 78.6569 };

const CENTER_EPSILON = 0.00001;

/** True only when a map is using the shared fallback rather than explicit coordinates. */
export function isDefaultMapCenter(center) {
  let latitude;
  let longitude;

  if (Array.isArray(center)) {
    [longitude, latitude] = center;
  } else if (center && typeof center === "object") {
    latitude = center.latitude ?? center.lat;
    longitude = center.longitude ?? center.lng ?? center.lon;
  }

  // Missing/invalid coordinates also mean the wrapper will use the shared
  // fallback, so allow device-location initialization in that case too.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return true;

  return (
    Math.abs(latitude - DEFAULT_CENTER.latitude) <= CENTER_EPSILON &&
    Math.abs(longitude - DEFAULT_CENTER.longitude) <= CENTER_EPSILON
  );
}
/** Avoid zooming into an arbitrary rural point when device location is unavailable. */
export function getInitialMapZoom(center, requestedZoom = 14) {
  return isDefaultMapCenter(center) ? 5 : (Number.isFinite(requestedZoom) ? requestedZoom : 14);
}
