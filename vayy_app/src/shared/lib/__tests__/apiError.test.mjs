import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeApiError } from "../apiError.js";

describe("normalizeApiError", () => {
  it("preserves structured backend messages", () => {
    assert.equal(
      normalizeApiError({ response: { data: { message: "No connected route." } } }).message,
      "No connected route.",
    );
  });

  it("preserves DRF string-valued field errors", () => {
    assert.equal(
      normalizeApiError({ response: { data: { city_id: "Unable to determine a service city." } } }).message,
      "Unable to determine a service city.",
    );
  });

  it("preserves DRF list-valued field errors", () => {
    assert.equal(
      normalizeApiError({ response: { data: { origin: ["Invalid coordinates."] } } }).message,
      "Invalid coordinates.",
    );
  });

  it("exposes transport errors instead of replacing them with the fallback", () => {
    assert.equal(normalizeApiError({ message: "Network Error" }, "Unable to create route.").message, "Network Error");
  });

  it("uses the fallback only when no useful response or transport message exists", () => {
    assert.equal(normalizeApiError({}, "Unable to create route.").message, "Unable to create route.");
  });
});
