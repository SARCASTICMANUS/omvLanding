export const HAND_RAISE_RADIUS_METERS = 3000;

/** Unknown distance is never treated as proof that a passenger reached the stop. */
export function isWithinStopBoardingRadius(distanceMeters) {
  return Number.isFinite(distanceMeters) && distanceMeters >= 0 &&
    distanceMeters <= HAND_RAISE_RADIUS_METERS;
}
