const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function readRoutePoint(point) {
  if (!point || typeof point !== "object") return null;
  const lat = toFiniteNumber(point.lat ?? point.latitude);
  const lng = toFiniteNumber(point.lon ?? point.lng ?? point.longitude);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return {
    lat,
    lng,
    label: point.name || point.label || point.display_name || point.address || null,
  };
}

export function getRouteEndpoints(route) {
  return {
    pickup: readRoutePoint(route?.pickup_stop) || readRoutePoint(route?.start) || readRoutePoint(route?.origin),
    dropoff: readRoutePoint(route?.dropoff_stop) || readRoutePoint(route?.destination) || readRoutePoint(route?.end),
  };
}

export function getRouteStopLabels({ trip, pickup, destination }) {
  const endpoints = getRouteEndpoints(trip);
  return {
    pickupLabel:
      trip?.pickup_stop?.name ||
      endpoints.pickup?.label ||
      pickup?.name ||
      pickup?.display_name ||
      "Pickup Point",
    dropoffLabel:
      trip?.dropoff_stop?.name ||
      endpoints.dropoff?.label ||
      destination?.name ||
      destination?.display_name ||
      "Drop-off Point",
  };
}

export function getValidRouteCoordinates(coordinates) {
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .filter((pair) =>
      Array.isArray(pair) &&
      pair.length >= 2 &&
      toFiniteNumber(pair[0]) !== null &&
      toFiniteNumber(pair[1]) !== null &&
      Math.abs(Number(pair[0])) <= 180 &&
      Math.abs(Number(pair[1])) <= 90
    )
    .map(([lng, lat]) => [Number(lng), Number(lat)]);
}

export function getRoutePreviewCenter(route, coordinates) {
  const validCoordinates = getValidRouteCoordinates(coordinates);
  if (validCoordinates.length) return validCoordinates[0];
  const { pickup, dropoff } = getRouteEndpoints(route);
  const point = pickup || dropoff;
  return point ? [point.lng, point.lat] : null;
}

export function getRoutePreviewBounds(coordinates, route) {
  const validCoordinates = getValidRouteCoordinates(coordinates);
  const endpoints = getRouteEndpoints(route);
  const points = validCoordinates.length >= 2
    ? validCoordinates
    : [endpoints.pickup, endpoints.dropoff]
        .filter(Boolean)
        .map(({ lng, lat }) => [lng, lat]);

  if (!points.length) return null;
  const longitudes = points.map(([lng]) => lng);
  const latitudes = points.map(([, lat]) => lat);
  let west = Math.min(...longitudes);
  let south = Math.min(...latitudes);
  let east = Math.max(...longitudes);
  let north = Math.max(...latitudes);

  // MapLibre cannot reliably fit a zero-area bounds box (e.g. one endpoint).
  if (east - west < 0.005) {
    west -= 0.005;
    east += 0.005;
  }
  if (north - south < 0.005) {
    south -= 0.005;
    north += 0.005;
  }
  return [west, south, east, north];
}