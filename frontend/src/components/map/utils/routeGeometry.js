export function getDistance(p1, p2) {
  const R = 6371e3;
  const phi1 = (p1[1] * Math.PI) / 180;
  const phi2 = (p2[1] * Math.PI) / 180;
  const dPhi = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLambda = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dLambda / 2) *
      Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isLikelyLonLat = ([first, second]) =>
  Math.abs(first) > 35 || Math.abs(second) <= 35;

export const normalizeCoordinate = (coord, fallbackOrder = "lonLat") => {
  if (!Array.isArray(coord) || coord.length < 2) return null;

  const first = toNumber(coord[0]);
  const second = toNumber(coord[1]);
  if (first === null || second === null) return null;

  if (fallbackOrder === "latLon") return [second, first];
  if (fallbackOrder === "lonLat") return [first, second];

  return isLikelyLonLat([first, second])
    ? [first, second]
    : [second, first];
};

export const normalizePath = (path, fallbackOrder = "auto") => {
  if (!Array.isArray(path)) return [];
  return path
    .map((coord) => normalizeCoordinate(coord, fallbackOrder))
    .filter(Boolean);
};

export const getStopLngLat = (stop) => {
  if (!stop) return null;

  if (Array.isArray(stop.location?.coordinates)) {
    return normalizeCoordinate(stop.location.coordinates, "lonLat");
  }

  const lat = toNumber(stop.lat);
  const lon = toNumber(stop.lon ?? stop.lng);
  if (lat === null || lon === null) return null;

  return [lon, lat];
};

export const getPreviewOptions = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.routes)) return data.routes;
  if (data?.path || data?.route_geometry || data?.path_coords) return [data];
  return [];
};

export const getPreviewPath = (preview) =>
  normalizePath(
    preview?.path || preview?.route_geometry || preview?.path_coords,
    "auto",
  );

export const getRoutePath = (route) =>
  normalizePath(route?.path_coords || route?.route_geometry || route?.path, "auto");
