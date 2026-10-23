import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getRouteEndpoints,
  getRoutePreviewBounds,
  getRoutePreviewCenter,
  getRouteStopLabels,
  getValidRouteCoordinates,
} from "../routePreviewUtils.js";

describe("route preview endpoints and timeline labels", () => {
  it("uses normalized start/destination when pickup/drop-off stops are absent", () => {
    const route = {
      start: { lat: 26.74, lng: 80.94, name: "Pickup address" },
      destination: { lat: 26.88, lng: 81.05, label: "Drop-off address" },
    };

    assert.deepEqual(getRouteEndpoints(route), {
      pickup: { lat: 26.74, lng: 80.94, label: "Pickup address" },
      dropoff: { lat: 26.88, lng: 81.05, label: "Drop-off address" },
    });
    assert.deepEqual(getRouteStopLabels({ trip: route }), {
      pickupLabel: "Pickup address",
      dropoffLabel: "Drop-off address",
    });
  });

  it("prefers explicit stop names and falls back to screen pickup/destination", () => {
    assert.deepEqual(getRouteStopLabels({
      trip: { pickup_stop: { name: "Stop A" }, dropoff_stop: { name: "Stop B" } },
      pickup: { name: "GPS pickup" },
      destination: { name: "GPS destination" },
    }), { pickupLabel: "Stop A", dropoffLabel: "Stop B" });

    assert.deepEqual(getRouteStopLabels({
      trip: {},
      pickup: { display_name: "GPS pickup" },
      destination: { display_name: "GPS destination" },
    }), { pickupLabel: "GPS pickup", dropoffLabel: "GPS destination" });
  });

  it("rejects invalid endpoint coordinates rather than centering on them", () => {
    assert.deepEqual(getRouteEndpoints({
      start: { lat: 999, lng: 80 },
      destination: { lat: 28.6, lng: 77.2 },
    }), {
      pickup: null,
      dropoff: { lat: 28.6, lng: 77.2, label: null },
    });
  });
});

describe("mini-map geometry fallback", () => {
  it("preserves valid route coordinates and rejects malformed pairs", () => {
    assert.deepEqual(getValidRouteCoordinates([
      [80.9, 26.7],
      [null, 26.8],
      [181, 26.8],
      [81.0, 26.8],
    ]), [[80.9, 26.7], [81, 26.8]]);
  });

  it("centers on route geometry first, then real endpoints if geometry is missing", () => {
    const route = {
      start: { lat: 26.7, lng: 80.9 },
      destination: { lat: 26.8, lng: 81.0 },
    };
    assert.deepEqual(getRoutePreviewCenter(route, []), [80.9, 26.7]);
    assert.deepEqual(getRoutePreviewCenter(route, [[81.1, 26.9], [81.2, 27.0]]), [81.1, 26.9]);
  });

  it("fits actual route geometry, or endpoint bounds when geometry is missing", () => {
    const route = {
      start: { lat: 26.7, lng: 80.9 },
      destination: { lat: 26.8, lng: 81.0 },
    };
    assert.deepEqual(getRoutePreviewBounds([], route), [80.9, 26.7, 81.0, 26.8]);
    assert.deepEqual(getRoutePreviewBounds([[80.8, 26.6], [81.1, 26.9]], route), [80.8, 26.6, 81.1, 26.9]);
  });

  it("pads a single endpoint so map fitBounds never receives a zero-area box", () => {
    const bounds = getRoutePreviewBounds([], { start: { lat: 26.7, lng: 80.9 } });
    assert.ok(bounds[0] < bounds[2]);
    assert.ok(bounds[1] < bounds[3]);
  });

  it("returns no map center when neither geometry nor real endpoints exist", () => {
    assert.equal(getRoutePreviewCenter({}, []), null);
    assert.equal(getRoutePreviewBounds([], {}), null);
  });
});
