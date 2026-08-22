function pointToSegmentDistSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return ex * ex + ey * ey;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return ex * ex + ey * ey;
}

export function splitRouteAtDriver(routePath, driverLat, driverLng) {
  if (!routePath || routePath.length < 2 || driverLat == null || driverLng == null) {
    return { covered: [], remaining: routePath || [] };
  }

  let bestIdx = 0;
  let bestDist = Infinity;

  for (let i = 0; i < routePath.length - 1; i++) {
    const [lngA, latA] = routePath[i];
    const [lngB, latB] = routePath[i + 1];
    const d = pointToSegmentDistSq(driverLng, driverLat, lngA, latA, lngB, latB);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const covered = routePath.slice(0, bestIdx + 1);
  const remaining = routePath.slice(bestIdx);

  return { covered, remaining };
}