#!/usr/bin/env node
/**
 * Import LKO routes from lko_routes_data.json into the Vayy backend.
 * RESUMABLE: skips routes already created, caches geocode results.
 *
 * Usage:  node scripts/import-lko-routes.mjs
 *         node scripts/import-lko-routes.mjs --skip-geocode   (reuse cached coords)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || "https://onmyvayy.com/api";
const CITY_ID = "382250c2-c5ae-4cc6-a11b-c16150b70954"; // Lucknow
const GEOCACHE_FILE = resolve(__dirname, ".geocache-lko.json");
const SKIP_GEOCODE = process.argv.includes("--skip-geocode");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── API helpers ──────────────────────────────────────────────────────────────
async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (res.status === 429) {
    const body = await res.json();
    const wait = parseThrottleWait(body.detail);
    console.log(`    ⏳ Rate limited. Waiting ${Math.ceil(wait / 1000)}s...`);
    await sleep(wait + 2000);
    return apiGet(path); // retry
  }
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const rBody = await res.json();
    const wait = parseThrottleWait(rBody.detail);
    console.log(`    ⏳ Rate limited. Waiting ${Math.ceil(wait / 1000)}s...`);
    await sleep(wait + 2000);
    return apiPost(path, body); // retry
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function parseThrottleWait(msg) {
  const m = msg?.match(/Expected available in (\d+) seconds/);
  return m ? parseInt(m[1]) * 1000 : 65000;
}

// ── Nominatim geocoder ───────────────────────────────────────────────────────
function loadGeoCache() {
  if (existsSync(GEOCACHE_FILE)) {
    try { return new Map(Object.entries(JSON.parse(readFileSync(GEOCACHE_FILE, "utf-8")))); }
    catch { /* ignore */ }
  }
  return new Map();
}

function saveGeoCache(map) {
  writeFileSync(GEOCACHE_FILE, JSON.stringify(Object.fromEntries(map), null, 2));
}

async function geocode(stopName, cache) {
  if (cache.has(stopName)) return cache.get(stopName);
  const q = encodeURIComponent(`${stopName}, Lucknow, India`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { "User-Agent": "VayyRouteImporter/1.0 (admin@vayy.com)" },
  });
  await sleep(1200); // Nominatim: max 1 req/s
  if (!res.ok) return null;
  const data = await res.json();
  if (data.length > 0) {
    const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    cache.set(stopName, coords);
    return coords;
  }
  return null;
}

const LKO_CENTER = { lat: 26.8467, lon: 80.9462 };
let fallbackIdx = 0;
function fallbackCoords(cache) {
  const angle = fallbackIdx * 0.35;
  const radius = 0.005 + fallbackIdx * 0.0008;
  fallbackIdx++;
  const c = {
    lat: LKO_CENTER.lat + Math.cos(angle) * radius,
    lon: LKO_CENTER.lon + Math.sin(angle) * radius,
  };
  return c;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Reading JSON data...");
  const raw = readFileSync(resolve(__dirname, "../../vayy_app/assets/lko_routes_data.json"), "utf-8");
  const data = JSON.parse(raw);
  const routes = Object.values(data.routes);

  // check existing routes
  console.log("Checking existing routes...");
  let existingRoutes = [];
  try {
    const res = await apiGet(`/transport/routes/?city_id=${CITY_ID}`);
    existingRoutes = Array.isArray(res) ? res : res.results || res.data || [];
    // Handle paginated response
    if (res.results) existingRoutes = res.results;
  } catch (e) {
    console.log("  Could not fetch existing routes:", e.message);
  }
  const existingCodes = new Set(existingRoutes.map((r) => r.route_code).filter(Boolean));
  const existingIds = new Set(existingRoutes.map((r) => r.id));
  console.log(`  Found ${existingRoutes.length} existing routes: ${[...existingCodes].join(", ") || "none"}`);

  // geocode — stops with lat/lng in JSON skip geocoding
  const geoCache = SKIP_GEOCODE ? loadGeoCache() : new Map();
  const coordsMap = new Map();
  const uniqueStops = new Set();
  let fromJson = 0;
  for (const r of routes) {
    for (const s of r.stops) {
      if (s.lat != null && s.lng != null) {
        coordsMap.set(s.name, { lat: s.lat, lon: s.lng });
        fromJson++;
      } else {
        uniqueStops.add(s.name);
      }
    }
  }
  console.log(`${fromJson} stops have coordinates in JSON`);

  if (SKIP_GEOCODE && geoCache.size > 0) {
    console.log(`Using ${geoCache.size} cached geocode results...`);
    for (const name of uniqueStops) {
      if (geoCache.has(name)) coordsMap.set(name, geoCache.get(name));
    }
  } else if (uniqueStops.size > 0) {
    console.log(`Geocoding ${uniqueStops.size} remaining stops...`);
    let geocoded = 0, fallbacks = 0;
    for (const name of uniqueStops) {
      const coords = await geocode(name, geoCache);
      if (coords) {
        coordsMap.set(name, coords);
        geocoded++;
      } else {
        const fb = fallbackCoords(geoCache);
        coordsMap.set(name, fb);
        geoCache.set(name, fb);
        fallbacks++;
      }
      const done = geocoded + fallbacks;
      if (done % 20 === 0 || done === uniqueStops.size) {
        console.log(`  [${done}/${uniqueStops.size}] geocoded=${geocoded} fallbacks=${fallbacks}`);
        saveGeoCache(geoCache);
      }
    }
    saveGeoCache(geoCache);
  }

  // create routes + stops
  console.log("\nImporting routes...");
  let created = 0, skipped = 0;
  for (const r of routes) {
    if (existingCodes.has(r.route_id)) {
      console.log(`  [${r.route_id}] Skipped (already exists)`);
      skipped++;
      continue;
    }

    const stopCoords = r.stops.map((s) => coordsMap.get(s.name) || fallbackCoords(geoCache));
    const pathCoords = stopCoords.map((c) => [c.lon, c.lat]);
    let totalDist = 0;
    for (let i = 1; i < pathCoords.length; i++) {
      totalDist += haversine(pathCoords[i - 1][1], pathCoords[i - 1][0], pathCoords[i][1], pathCoords[i][0]);
    }

    try {
      const res = await apiPost("/transport/routes/", {
        city: CITY_ID,
        name: r.route_name,
        route_code: r.route_id,
        path: { type: "LineString", coordinates: pathCoords },
        start_name: r.start,
        end_name: r.end,
        total_distance_meters: Math.round(totalDist),
        is_public: true,
      });
      const routeId = res.id || res.data?.id;
      if (!routeId) {
        console.error(`  [${r.route_id}] No route ID:`, JSON.stringify(res).slice(0, 200));
        continue;
      }

      let stopsCreated = 0;
      for (const s of r.stops) {
        const c = coordsMap.get(s.name) || fallbackCoords(geoCache);
        try {
          await apiPost("/transport/stops/", {
            route: routeId,
            name: s.name,
            location: { type: "Point", coordinates: [c.lon, c.lat] },
            order: s.seq,
          });
          stopsCreated++;
        } catch (e) {
          console.error(`    Stop ${s.name}: ${e.message.slice(0, 100)}`);
        }
      }
      created++;
      console.log(`  [${r.route_id}] ✓ ${r.route_name} (${stopsCreated}/${r.stops.length} stops)`);
    } catch (e) {
      console.error(`  [${r.route_id}] ✗ ${e.message.slice(0, 150)}`);
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Total: ${routes.length}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
