const normalizeImportKey = (key) =>
  String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeImportRow = (row) =>
  Object.entries(row || {}).reduce((acc, [key, value]) => {
    acc[normalizeImportKey(key)] = value;
    return acc;
  }, {});

const firstValue = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePoint = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const first = toFiniteNumber(value[0]);
    const second = toFiniteNumber(value[1]);
    if (first === null || second === null) return null;
    return Math.abs(first) > 35
      ? { lat: second, lon: first }
      : { lat: first, lon: second };
  }

  if (value && typeof value === "object") {
    const normalized = normalizeImportRow(value);
    const lat = toFiniteNumber(firstValue(normalized, ["lat", "latitude"]));
    const lon = toFiniteNumber(firstValue(normalized, ["lon", "lng", "longitude"]));
    if (lat !== null && lon !== null) return { lat, lon };
  }

  return null;
};

const pointFromRow = (row, prefix) => {
  const lat = toFiniteNumber(firstValue(row, [`${prefix}_lat`, `${prefix}_latitude`]));
  const lon = toFiniteNumber(
    firstValue(row, [`${prefix}_lon`, `${prefix}_lng`, `${prefix}_longitude`]),
  );
  return lat !== null && lon !== null ? { lat, lon } : null;
};

const normalizeStop = (stop, index = 0) => {
  const normalized = normalizeImportRow(stop);
  const point = normalizePoint(stop) || pointFromRow(normalized, "stop");
  if (!point) return null;

  return {
    ...point,
    name: firstValue(normalized, ["stop_name", "name"]) || `Stop ${index + 1}`,
    order: toFiniteNumber(firstValue(normalized, ["stop_order", "order", "sequence"])) ?? index,
  };
};

const normalizePathForBackend = (path) => {
  if (!Array.isArray(path)) return undefined;
  const normalized = path
    .map((point) => normalizePoint(point))
    .filter(Boolean)
    .map((point) => [point.lat, point.lon]);
  return normalized.length > 1 ? normalized : undefined;
};

export const normalizeJsonRoutes = (payload) => {
  const routes = Array.isArray(payload) ? payload : payload?.routes;
  if (!Array.isArray(routes)) {
    throw new Error("JSON file must contain an array of routes or an object with a routes array.");
  }

  return routes.map((route, index) => {
    const normalized = normalizeImportRow(route);
    const start =
      normalizePoint(route.start) ||
      pointFromRow(normalized, "start") ||
      pointFromRow(normalized, "origin");
    const end =
      normalizePoint(route.end) ||
      pointFromRow(normalized, "end") ||
      pointFromRow(normalized, "destination");
    const stops = Array.isArray(route.stops)
      ? route.stops.map((stop, stopIndex) => normalizeStop(stop, stopIndex)).filter(Boolean)
      : [];

    return {
      name: firstValue(normalized, ["route_name", "name"]) || `Imported Route ${index + 1}`,
      bus_number: firstValue(normalized, ["bus_number", "bus", "vehicle_number"]),
      start_name: firstValue(normalized, ["start_name", "origin_name"]) || "Start",
      end_name: firstValue(normalized, ["end_name", "destination_name"]) || "End",
      total_distance: toFiniteNumber(
        firstValue(normalized, ["total_distance", "total_distance_meters", "distance"]),
      ),
      path: normalizePathForBackend(route.path || route.path_coords || route.route_geometry),
      start,
      end,
      stops,
    };
  });
};

export const normalizeExcelRoutes = (rows) => {
  const groupedRoutes = new Map();

  rows.map(normalizeImportRow).forEach((row, index) => {
    const routeName = firstValue(row, ["route_name", "name"]) || `Imported Route ${index + 1}`;
    const routeKey =
      firstValue(row, ["route_id", "route_key", "route_code", "route_name", "name"]) ||
      routeName;

    if (!groupedRoutes.has(routeKey)) {
      groupedRoutes.set(routeKey, {
        name: routeName,
        bus_number: firstValue(row, ["bus_number", "bus", "vehicle_number"]),
        start_name: firstValue(row, ["start_name", "origin_name"]) || "Start",
        end_name: firstValue(row, ["end_name", "destination_name"]) || "End",
        start: pointFromRow(row, "start") || pointFromRow(row, "origin"),
        end: pointFromRow(row, "end") || pointFromRow(row, "destination"),
        stops: [],
      });
    }

    const route = groupedRoutes.get(routeKey);
    route.start = route.start || pointFromRow(row, "start") || pointFromRow(row, "origin");
    route.end = route.end || pointFromRow(row, "end") || pointFromRow(row, "destination");

    const stop = normalizeStop(row, route.stops.length);
    if (stop) route.stops.push(stop);
  });

  return Array.from(groupedRoutes.values()).map((route) => ({
    ...route,
    stops: route.stops.sort((a, b) => a.order - b.order),
  }));
};
