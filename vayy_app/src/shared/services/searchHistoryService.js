import api from "../lib/api";
import { AUTH } from "../../constants";

/**
 * omv-backend answers recent searches FLAT, and the field names are not
 * symmetric. A real row:
 *
 *   { id, pickup_name, pickup_lat, pickup_lon,
 *      origin_name, origin_lat, origin_lng,          <-- lng, and NO origin_lon
 *      destination_name, destination_lat,
 *      destination_lon, destination_lng,            <-- both lon AND lng
 *      created_at }
 *
 * The screens (DriverAutoHomeScreen:64-66,282,285 · DriverBikeHomeScreen:137-139,
 * 379,382 · PassengerTripPlanner:48-49,275-277) all read the NESTED shape
 * `item.pickup.name` / `item.destination.name` and hand the same objects to
 * `setPickup` / `setDestination`, so without this the RECENT SEARCHES list renders
 * "Unknown" / "To: Unknown" for every row even though the data is there.
 *
 * Mapping lives here, in the service, so no component is touched.
 */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const point = (name, lat, lon, lng) => {
  const label = name || "";
  return { name: label, display_name: label, lat: num(lat), lon: num(lon ?? lng) };
};

export const normalizeRecentSearch = (item) => {
  if (!item || typeof item !== "object") return null;
  // Already nested (or a future backend shape) - pass it through untouched.
  if (item.pickup && item.destination) return item;

  const pickupName = item.pickup_name ?? item.origin_name;
  const pickupLat = item.pickup_lat ?? item.origin_lat;
  const pickupLon = item.pickup_lon ?? item.origin_lon ?? item.origin_lng;

  const destName = item.destination_name ?? item.dest_name;
  const destLat = item.destination_lat ?? item.dest_lat;
  const destLon = item.destination_lon ?? item.destination_lng ?? item.dest_lon;

  return {
    ...item,
    id: item.id,
    created_at: item.created_at,
    pickup: point(pickupName, pickupLat, pickupLon),
    destination: point(destName, destLat, destLon),
  };
};

/**
 * Fetch recent searches for the current user (from Redis, fallback DB).
 * Returns the top recent searches in the nested shape the screens expect.
 */
export const getRecentSearches = async () => {
  try {
    const response = await api.get(AUTH.recentSearches);
    const data = response.data?.data ?? response.data;
    if (!Array.isArray(data)) return [];
    return data.map(normalizeRecentSearch).filter(Boolean);
  } catch (error) {
    console.error("Failed to fetch recent searches:", error);
    return [];
  }
};

/**
 * Save a recent search for the current user.
 * Deduplicates by pickup+destination lat/lon.
 * Stored in Redis (48h TTL) and persisted to DB if unique.
 */
export const saveRecentSearch = async (searchData) => {
  try {
    await api.post(AUTH.recentSearches, searchData);
  } catch (error) {
    console.error("Failed to save recent search:", error);
  }
};
