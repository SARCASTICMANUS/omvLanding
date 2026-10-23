import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../../shared/lib/api";
import { TRANSPORT } from "../../constants";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { findNearestServiceCity, MAX_AUTOMATIC_CITY_MATCH_METERS } from "./serviceCityMatching";

// Conservative client guard: centroids are not service boundaries, so avoid assigning a distant city.
export const MAX_CITY_MATCH_METERS = MAX_AUTOMATIC_CITY_MATCH_METERS;

// Re-check the city list at most this often; deployments change rarely.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

let inflight = null;

/**
 * Django serialises a PointField as WKT, e.g.
 * "SRID=4326;POINT (80.9462 26.8467)" — longitude first, then latitude.
 * Accepts GeoJSON ({ type, coordinates:[lng,lat] }) too, in case the backend
 * representation changes.
 */
function parseLocation(raw) {
  if (!raw) return null;

  if (typeof raw === "object") {
    const [lng, lat] = raw.coordinates || [];
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return null;
  }

  if (typeof raw !== "string") return null;

  const wkt = raw.match(/POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)/i);
  if (!wkt) return null;

  const lng = Number(wkt[1]);
  const lat = Number(wkt[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function normalizeCities(body) {
  // The endpoint is paginated: { count, next, previous, results: [...] }.
  const rows = Array.isArray(body) ? body : body?.results || body?.data || [];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => ({
      id: row?.id,
      name: row?.name,
      state: row?.state,
      location: parseLocation(row?.location),
    }))
    .filter((city) => city.id && city.location);
}

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.serviceCity);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.resolvedAt) return null;
    if (Date.now() - parsed.resolvedAt > CACHE_TTL_MS) return null;
    return Array.isArray(parsed.cities) && parsed.cities.length ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(cities) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.serviceCity,
      JSON.stringify({ cities, resolvedAt: Date.now() }),
    );
  } catch {
    // A cache write failure must never break route search.
  }
}

/** Cities with a usable centroid, from cache or the network. */
export async function loadServiceCities({ force = false } = {}) {
  if (!force) {
    const cached = await readCache();
    if (cached) return cached.cities;
  }

  if (!inflight) {
    inflight = (async () => {
      const response = await api.get(TRANSPORT.cities);
      const cities = normalizeCities(response.data);
      if (cities.length) await writeCache(cities);
      return cities;
    })().finally(() => {
      inflight = null;
    });
  }

  return inflight;
}

/**
 * Nearest service city to a coordinate.
 * @returns {Promise<{id:string,name:string,location:{lat:number,lng:number},distanceMeters:number}|null>}
 *          null when there is no city, no centroid, or nothing within range.
 */
export async function resolveServiceCity(lat, lng, { force = false } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  let cities = [];
  try {
    cities = await loadServiceCities({ force });
  } catch {
    // Offline or a failed cities call: use a still-valid cached list if available.
    // If no city can be resolved, the route service fails closed.
    const cached = await readCache();
    cities = cached?.cities || [];
  }
  if (!cities.length) return null;

  // Do not let the backend's broad 100 km fallback become a confident client-side
  // assignment. If no centroid is close enough, leave city_id unresolved.
  return findNearestServiceCity(lat, lng, cities, MAX_CITY_MATCH_METERS);
}

/**
 * Best-effort city id for a route request. Returns null rather than throwing;
 * routeService rejects null to avoid the backend's broad nearest-centroid fallback.
 */
export async function serviceCityIdFor(lat, lng, options) {
  try {
    const city = await resolveServiceCity(lat, lng, options);
    return city?.id ?? null;
  } catch {
    return null;
  }
}

export default { loadServiceCities, resolveServiceCity, serviceCityIdFor };