import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HAND_RAISE_RADIUS_METERS, isWithinStopBoardingRadius } from "../handRaiseUtils.js";

describe("Hand Raise stop proximity", () => {
  it("allows boarding intent at or inside 3 kilometres", () => {
    assert.equal(isWithinStopBoardingRadius(0), true);
    assert.equal(isWithinStopBoardingRadius(3000), true);
    assert.equal(isWithinStopBoardingRadius(2999.9), true);
    assert.equal(HAND_RAISE_RADIUS_METERS, 3000);
  });

  it("blocks passengers outside the radius or with unknown GPS distance", () => {
    assert.equal(isWithinStopBoardingRadius(3000.1), false);
    assert.equal(isWithinStopBoardingRadius(null), false);
    assert.equal(isWithinStopBoardingRadius(undefined), false);
    assert.equal(isWithinStopBoardingRadius(NaN), false);
    assert.equal(isWithinStopBoardingRadius(-1), false);
  });
});
