import { haversine } from "../../shared/utils/walkingDistance.js";

// Centroids are approximate city representatives, not service-area boundaries.
// Keep automatic assignment conservative; unresolved GPS must not be labelled as
// a city merely because it falls within the backend's broad 100 km fallback.
export const MAX_AUTOMATIC_CITY_MATCH_METERS = 12000;

export function findNearestServiceCity(lat, lng, cities, maxDistanceMeters = MAX_AUTOMATIC_CITY_MATCH_METERS) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 || lat > 90 ||
    lng < -180 || lng > 180 ||
    !Array.isArray(cities) ||
    !Number.isFinite(maxDistanceMeters) ||
    maxDistanceMeters < 0
  ) {
    return null;
  }

  let best = null;
  for (const city of cities) {
    const cityLat = city?.location?.lat;
    const cityLng = city?.location?.lng;
    if (
      !city?.id ||
      !Number.isFinite(cityLat) ||
      !Number.isFinite(cityLng) ||
      cityLat < -90 || cityLat > 90 ||
      cityLng < -180 || cityLng > 180
    ) continue;

    const distanceMeters = haversine(lat, lng, cityLat, cityLng);
    if (!best || distanceMeters < best.distanceMeters) {
      best = { ...city, distanceMeters };
    }
  }

  return best && best.distanceMeters <= maxDistanceMeters ? best : null;
}
/** Let the authenticated route-preview endpoint resolve omitted IDs from its canonical city configuration. */
export function requireServiceCityId(cityId) {
  return cityId == null || cityId === "" ? null : cityId;
}
