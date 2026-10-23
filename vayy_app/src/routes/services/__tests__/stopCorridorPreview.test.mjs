import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeDynamicRoutes, toRouteGeoJSON } from "../dynamicRouteNormalizer.js";

describe("stop-corridor dynamic preview contract", () => {
  it("preserves a successful empty route result", () => {
    assert.deepEqual(normalizeDynamicRoutes({
      success: true,
      data: { routes: [] },
    }), []);
  });

  it("does not treat global-stop proximity or vehicle time as walking data", () => {
    const [route] = normalizeDynamicRoutes({
      success: true,
      data: { routes: [{
        route: {
          id: "route-no-walking-profile",
          start: { lat: 26.8, lng: 80.9, name: "Pickup stop" },
          destination: { lat: 26.9, lng: 80.9, name: "Drop stop" },
          geometry: { type: "LineString", coordinates: [[80.9, 26.8], [80.9, 26.9]] },
          distance_m: 5000,
          transit_duration_s: 900,
          duration_s: null,
          eta_seconds: null,
          walking_directions_available: false,
          pickup_stop: { id: "p", name: "Pickup stop", lat: 26.8, lon: 80.9, proximity_meters: 100 },
          dropoff_stop: { id: "d", name: "Drop stop", lat: 26.9, lon: 80.9, proximity_meters: 150 },
          first_mile_walk_meters: null,
          last_mile_walk_meters: null,
          stops: [],
        },
        fare: { buddy_fare: 40 },
      }] },
    }, { audience: "passenger" });

    assert.equal(route.first_mile_walk_meters, null);
    assert.equal(route.last_mile_walk_meters, null);
    assert.equal(route.eta_seconds, null);
    assert.equal(route.walking_directions_available, false);
  });

  it("uses selected main-road stops as ride endpoints, not exact GPS coordinates", () => {
    const result = normalizeDynamicRoutes({
      success: true,
      data: {
        routes: [{
          route: {
            id: "route-a",
            name: "Sector 15 → Noida City Centre",
            start: { lat: 28.5700, lng: 77.3200, name: "Sector 15 Bus Stop", label: "Sector 15 Bus Stop" },
            destination: { lat: 28.5759, lng: 77.3573, name: "Noida City Centre Bus Stand", label: "Noida City Centre Bus Stand" },
            geometry: { type: "LineString", coordinates: [[77.3200, 28.5700], [77.34, 28.572], [77.3573, 28.5759]] },
            distance_m: 4200,
            duration_s: 600,
            stops: [{ id: "s1", name: "Sector 15 Bus Stop", lat: 28.57, lon: 77.32, lng: 77.32, location: { type: "Point", coordinates: [77.32, 28.57] } }],
            stop_count: 1,
            walking_path: { type: "LineString", coordinates: [[77.319, 28.569], [77.32, 28.57]] },
          },
          pickup_stop: { id: "s1", name: "Sector 15 Bus Stop", lat: 28.57, lon: 77.32, lng: 77.32, distance_meters: 180 },
          dropoff_stop: { id: "s2", name: "Noida City Centre Bus Stand", lat: 28.5759, lon: 77.3573, lng: 77.3573, distance_to_destination_meters: 220 },
          first_mile_walk_meters: 180,
          last_mile_walk_meters: 220,
          stops: [{ id: "s1", name: "Sector 15 Bus Stop", lat: 28.57, lon: 77.32, lng: 77.32, location: { type: "Point", coordinates: [77.32, 28.57] } }],
          fare: { buddy_fare: 33.6, marshal_earning: 30 },
        }],
      },
    }, { audience: "passenger" });

    assert.equal(result.length, 1);
    assert.equal(result[0].pickup_stop.name, "Sector 15 Bus Stop");
    assert.equal(result[0].dropoff_stop.name, "Noida City Centre Bus Stand");
    assert.equal(result[0].pickup_stop.lat, 28.57);
    assert.equal(result[0].first_mile_walk_meters, 180);
    assert.equal(result[0].last_mile_walk_meters, 220);
    assert.deepEqual(result[0].walking_path.coordinates[0], [77.319, 28.569]);
    assert.equal(toRouteGeoJSON(result[0]).coordinates.length, 3);
  });

  it("keeps OSRM global-stop proximity separate from walking distance", () => {
    const [route] = normalizeDynamicRoutes({
      data: { routes: [{
        route: {
          id: "generated-route-id",
          route_source: "osrm_global_stops",
          start: { lat: 26.8, lng: 80.9, label: "Start stop" },
          destination: { lat: 26.9, lng: 80.9, label: "End stop" },
          geometry: { type: "LineString", coordinates: [[80.9, 26.8], [80.9, 26.9]] },
          distance_m: 11000,
          first_mile_proximity_meters: 320,
          first_mile_walk_meters: null,
          walking_path: null,
          walking_directions_available: false,
          stops: [{ id: "start", name: "Start stop", lat: 26.8, lng: 80.9 }, { id: "end", name: "End stop", lat: 26.9, lng: 80.9 }],
        },
        first_mile_proximity_meters: 320,
        fare: { buddy_fare: 88 },
      }] },
    }, { audience: "passenger" });

    assert.equal(route.id, "generated-route-id");
    assert.equal(route.generated_from_global_stops, true);
    assert.equal(route.first_mile_proximity_meters, 320);
    assert.equal(route.first_mile_walk_meters, null);
    assert.equal(route.walking_path, null);
  });
});
