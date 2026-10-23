import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findNearestServiceCity, requireServiceCityId } from "../serviceCityMatching.js";

const cities = [
  { id: "lucknow", name: "Lucknow", location: { lat: 26.8467, lng: 80.9462 } },
  { id: "noida", name: "Noida", location: { lat: 28.5706333, lng: 77.3272147 } },
];

describe("findNearestServiceCity", () => {
  it("recognizes the saved SGPGI pickup inside Lucknow's centroid radius", () => {
    assert.equal(findNearestServiceCity(26.7435744, 80.9451722, cities)?.id, "lucknow");
  });

  it("rejects a pickup outside the client centroid radius for backend resolution", () => {
    assert.equal(findNearestServiceCity(26.7394, 80.9968, cities), null);
  });

  it("resolves a pickup near Noida's centroid", () => {
    assert.equal(findNearestServiceCity(28.55, 77.34, cities)?.id, "noida");
  });

  it("does not assign a Delhi-area pickup to the distant Noida centroid", () => {
    // Approximate central Delhi: about 12.5 km from the supplied Noida centroid.
    assert.equal(findNearestServiceCity(28.6139, 77.209, cities), null);
  });

  it("returns null for invalid coordinates", () => {
    assert.equal(findNearestServiceCity(NaN, 80.9, cities), null);
    assert.equal(findNearestServiceCity(26.8, 181, cities), null);
  });

  it("does not assign a city when the city-list response is unavailable", () => {
    assert.equal(findNearestServiceCity(26.8, 80.9, []), null);
    assert.equal(findNearestServiceCity(26.8, 80.9, null), null);
    assert.equal(findNearestServiceCity(26.8, 80.9, undefined), null);
  });

  it("ignores cities with malformed centroids", () => {
    assert.equal(
      findNearestServiceCity(26.8, 80.9, [{ id: "bad", location: { lat: NaN, lng: 80.9 } }]),
      null,
    );
    assert.equal(findNearestServiceCity(26.8, 80.9, [{ id: "missing" }]), null);
  });
});
describe("requireServiceCityId", () => {
  it("leaves an unresolved city for the authenticated backend to resolve", () => {
    assert.equal(requireServiceCityId(null), null);
    assert.equal(requireServiceCityId(""), null);
  });

  it("preserves an explicitly resolved city id", () => {
    assert.equal(requireServiceCityId("lucknow"), "lucknow");
  });
});
