/**
 * Contract gate: the REAL, UNMODIFIED frontend normalizer against a REAL
 * omv-backend dynamic-preview body.
 *
 * The omv-backend COMPAT layer nests its payload under `data.route` /
 * `data.dynamic_route` precisely so this extractor stops returning []. If that
 * alias is ever dropped, this check fails loudly instead of the Route Card
 * silently rendering an empty state in production.
 *
 * Capture a fresh body first:
 *   curl -s -o ../docs/BACKEND2_EVIDENCE/03_dynamic_preview.json \
 *     -X POST http://localhost:8000/api/transport/routes/dynamic-preview/ \
 *     -H "Authorization: Bearer <jwt>" -H "Content-Type: application/json" \
 *     --data-binary '{"city":"lucknow","origin":{"lat":26.8321956,"lng":80.9216493},
 *                    "destination":{"lat":26.8190637,"lng":80.907629}}'
 *
 * Then:  npm run check:normalizer
 * (ext_resolver.mjs only re-adds the extensions Vite allows but plain Node ESM
 *  does not, so no frontend source needs changing.)
 */
import { readFileSync } from "node:fs";
import { normalizeDynamicRoutes } from "../src/services/routes/dynamicRouteNormalizer.js";

const raw = readFileSync(
  new URL("../../docs/BACKEND2_EVIDENCE/03_dynamic_preview.json", import.meta.url),
  "utf8",
);
const body = JSON.parse(raw);

const routes = normalizeDynamicRoutes(body, { audience: "passenger", cityLabel: "Lucknow" });

console.log("routes returned:", routes.length);

if (routes.length === 0) {
  console.log("FAIL - normalizer produced [] (Route Card would render empty)");
  process.exit(1);
}

const r = routes[0];
console.log("id                :", r.id);
console.log("dynamicRouteId    :", r.dynamicRouteId);
console.log("routeContext.id   :", r.routeContext?.dynamicRouteId);
console.log("code (by design)  :", r.route_code);
console.log("name              :", r.name);
console.log("total_distance    :", r.total_distance);
console.log("eta_seconds       :", r.eta_seconds);
console.log("distance_km       :", r.distance_km);
console.log("duration_minutes  :", r.duration_minutes);
console.log("stops             :", Array.isArray(r.stops) ? r.stops.length : r.stops);
console.log("fare              :", r.fare);
console.log("fare_breakdown    :", JSON.stringify(r.fare_breakdown));
console.log("source            :", r.source);

// PassengerSearching.jsx:48-50 reads these exact fields.
console.log("pickup_stop.id    :", r.pickup_stop?.id);
console.log("dropoff_stop.id   :", r.dropoff_stop?.id);
console.log("pickup_stop.name  :", r.pickup_stop?.name);
console.log("dropoff_stop.name :", r.dropoff_stop?.name);

// route_geometry is emitted as a resolved [lng,lat] ARRAY by the normalizer.
console.log("route_geometry len:", Array.isArray(r.route_geometry) ? r.route_geometry.length : typeof r.route_geometry);
console.log("geometry is GeoJSON:", r.geometry?.type);
console.log("first coord       :", JSON.stringify(r.route_geometry?.[0]));

// Hard assertions mirroring PassengerSearching's client-side guard.
const problems = [];
const pickupStopId = r.pickup_stop?.id || r.pickup_stop?.stop_id;
const dropStopId = r.dropoff_stop?.id || r.dropoff_stop?.stop_id;
if (!r.id && !r.dynamicRouteId) problems.push("no route id -> Select Route cannot forward");
if (!pickupStopId) problems.push("pickup_stop.id missing -> invalidRequest=true, dispatch POST blocked client-side");
if (!dropStopId) problems.push("dropoff_stop.id missing");
if (!Array.isArray(r.stops) || r.stops.length === 0) problems.push("no ordered stops");
if (!Array.isArray(r.route_geometry) || r.route_geometry.length === 0) problems.push("no polyline coords");
if (r.geometry?.type !== "LineString") problems.push("geometry is not a GeoJSON LineString");
const first = r.route_geometry?.[0];
if (first && (first[0] < 72 || first[0] > 88)) {
  problems.push(`polyline lng looks like a mirrored hemisphere: ${JSON.stringify(first)}`);
}
if (r.fare == null) problems.push("no fare");

if (problems.length) {
  console.log("\nFAIL:");
  problems.forEach((p) => console.log("  - " + p));
  process.exit(1);
}
console.log("\nPASS - normalizer consumed the omv-backend payload end to end");