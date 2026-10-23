import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CENTER, isDefaultMapCenter, getInitialMapZoom } from "../mapConfig.js";

describe("map default center", () => {
  it("uses a neutral India fallback rather than hardcoding Lucknow", () => {
    assert.notEqual(DEFAULT_CENTER.latitude, 26.8467);
    assert.notEqual(DEFAULT_CENTER.longitude, 80.9462);
    assert.ok(DEFAULT_CENTER.latitude >= 6 && DEFAULT_CENTER.latitude <= 38);
    assert.ok(DEFAULT_CENTER.longitude >= 68 && DEFAULT_CENTER.longitude <= 98);
  });

  it("recognizes the fallback in object and MapLibre [lng, lat] formats", () => {
    assert.equal(isDefaultMapCenter(DEFAULT_CENTER), true);
    assert.equal(isDefaultMapCenter([DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude]), true);
  });

  it("does not override an explicit city or route coordinate", () => {
    assert.equal(isDefaultMapCenter({ latitude: 28.6139, longitude: 77.209 }), false);
    assert.equal(isDefaultMapCenter([77.209, 28.6139]), false);
  });

  it("treats missing or malformed centers as eligible for device-location fallback", () => {
    assert.equal(isDefaultMapCenter(null), true);
    assert.equal(isDefaultMapCenter([undefined, undefined]), true);
  });
});
describe("getInitialMapZoom", () => {
  it("uses a broad zoom for fallback coordinates", () => {
    assert.equal(getInitialMapZoom(DEFAULT_CENTER, 14), 5);
    assert.equal(getInitialMapZoom(null, 14), 5);
  });

  it("preserves the requested zoom for explicit coordinates", () => {
    assert.equal(getInitialMapZoom([77.209, 28.6139], 14), 14);
  });
});
