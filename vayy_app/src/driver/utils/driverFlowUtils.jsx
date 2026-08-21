import { calculateFare } from "../../shared/services/fareEstimationService";

export const hasValidCoords = (point) =>
  point &&
  typeof point.lat === "number" &&
  Number.isFinite(point.lat) &&
  typeof point.lon === "number" &&
  Number.isFinite(point.lon);

const shortPlaceName = (value, fallback = "--") => {
  if (!value) return fallback;
  const base = String(value).split(",")[0].trim();
  if (!base) return fallback;
  return base.length > 26 ? `${base.slice(0, 26).trim()}...` : base;
};

const firstTruthy = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const normalizeStop = (stop, index) => {
  const lat = Number(stop?.lat ?? stop?.latitude ?? stop?.location?.lat ?? stop?.coords?.[1]);
  const lon = Number(stop?.lon ?? stop?.lng ?? stop?.longitude ?? stop?.location?.lon ?? stop?.coords?.[0]);

  return {
    ...stop,
    id: stop?.id || stop?.stop_id || `stop-${index + 1}`,
    name: stop?.name || stop?.stop_name || stop?.label || stop?.address || `Stop ${index + 1}`,
    order: Number.isFinite(Number(stop?.order))
      ? Number(stop.order)
      : Number.isFinite(Number(stop?.sequence))
        ? Number(stop.sequence)
        : index,
    lat: Number.isFinite(lat) ? lat : stop?.lat,
    lon: Number.isFinite(lon) ? lon : stop?.lon,
  };
};

export const getOrderedRouteStops = (route) => {
  const rawStops =
    (Array.isArray(route?.stops) && route.stops) ||
    (Array.isArray(route?.route_stops) && route.route_stops) ||
    (Array.isArray(route?.stop_details) && route.stop_details) ||
    (Array.isArray(route?.route?.stops) && route.route.stops) ||
    [];

  const normalizedStops = rawStops
    .map((stop, index) => normalizeStop(stop, index))
    .sort((a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0));

  if (normalizedStops.length > 0) return normalizedStops;

  const startName = shortPlaceName(
    route?.source_name || route?.start_name || route?.origin_name || route?.start_stop_name,
    "",
  );
  const endName = shortPlaceName(
    route?.destination_name || route?.end_name || route?.terminal_name || route?.end_stop_name,
    "",
  );

  const fallbackStops = [];
  if (startName) {
    fallbackStops.push({
      id: `${route?.id || "route"}-start`,
      name: startName,
      order: 0,
      is_boarding_point: true,
    });
  }
  if (endName) {
    fallbackStops.push({
      id: `${route?.id || "route"}-end`,
      name: endName,
      order: fallbackStops.length,
    });
  }

  return fallbackStops;
};

export const formatDistanceText = (route) => {
  const meters = Number(
    firstTruthy(route?.total_distance, route?.total_distance_meters, route?.distance_meters, route?.distance),
  );

  if (Number.isFinite(meters) && meters > 0) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  }

  if (route?.distance_text) return route.distance_text;
  if (route?.distance_km) return `${route.distance_km} km`;
  return "--";
};

export const getDistanceMeters = (route) => {
  const meters = Number(
    firstTruthy(route?.total_distance, route?.total_distance_meters, route?.distance_meters, route?.distance),
  );
  return Number.isFinite(meters) ? meters : 0;
};

export const getDurationMinutes = (route) => {
  const durationMinutes = Number(firstTruthy(route?.duration_minutes, route?.eta_minutes));
  if (Number.isFinite(durationMinutes) && durationMinutes > 0) return Math.round(durationMinutes);

  const durationSeconds = Number(
    firstTruthy(route?.duration_seconds, route?.eta_seconds, route?.estimated_duration),
  );
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return Math.max(1, Math.ceil(durationSeconds / 60));
  }

  return 0;
};

export const formatDurationText = (route) => {
  const minutes = getDurationMinutes(route);
  if (!minutes) return "--";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const getRouteStatus = (route) => {
  const active = Boolean(
    route?.is_active ||
      route?.active ||
      route?.active_trip ||
      route?.trip_live ||
      route?.status === "active" ||
      route?.status === "live" ||
      Number(route?.active_trip_count) > 0,
  );

  return { active, label: active ? "Active" : "Inactive" };
};

export const getRouteTitle = (route) =>
  route?.name || route?.route_name || route?.title || `Route ${route?.id || ""}`.trim();

export const getRouteCode = (route) =>
  route?.code ||
  route?.route_code ||
  route?.bus_number ||
  route?.short_name ||
  route?.route_number ||
  `RT-${route?.id || "--"}`;

export const getBoardingPointCount = (route) =>
  getOrderedRouteStops(route).filter((stop) => stop?.is_boarding_point || stop?.pickup_allowed || stop?.boarding).length;

const getCoord = (stop) => {
  const lat = Number(stop?.lat);
  const lon = Number(stop?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon)
    ? { latitude: lat, longitude: lon }
    : null;
};

export const buildRouteSummary = (route) => {
  const stops = getOrderedRouteStops(route);
  const startStop = stops[0];
  const endStop = stops[stops.length - 1];
  const durationMinutes = getDurationMinutes(route);
  const totalMinutes = durationMinutes || Math.max(stops.length * 6, 12);
  const stepMinutes = stops.length > 1 ? totalMinutes / (stops.length - 1) : totalMinutes;
  const fallbackArrivalLabel = (stop, index) =>
    stop?.arrival_time ||
    stop?.departure_time ||
    stop?.eta_label ||
    stop?.scheduled_time ||
    `+${Math.max(0, Math.round(index * stepMinutes))} min`;

  return {
    ...route,
    stops,
    distanceText: formatDistanceText(route),
    durationText: formatDurationText(route),
    durationMinutes,
    distanceMeters: getDistanceMeters(route),
    stopsCount: stops.length,
    boardingPoints: getBoardingPointCount(route),
    title: getRouteTitle(route),
    code: getRouteCode(route),
    status: getRouteStatus(route),
    startLabel: shortPlaceName(
      startStop?.name || route?.source_name || route?.start_name || route?.origin_name || route?.start_stop_name,
    ),
    endLabel: shortPlaceName(
      endStop?.name || route?.destination_name || route?.end_name || route?.terminal_name || route?.end_stop_name,
    ),
    startTimeLabel: route?.start_time || route?.departure_time || (startStop ? fallbackArrivalLabel(startStop, 0) : "--"),
    endTimeLabel:
      route?.end_time ||
      route?.arrival_time ||
      (endStop ? fallbackArrivalLabel(endStop, Math.max(stops.length - 1, 0)) : "--"),
    startCoord: getCoord(startStop),
    endCoord: getCoord(endStop),
    fare: route?.fare || route?.estimated_fare || calculateFare(getDistanceMeters(route) / 1000, "auto") || null,
    viaLabel: route?.viaLabel || route?.via || (stops.length > 2 ? stops[1]?.name : null),
  };
};

export const estimateStopTimeline = (route) => {
  const summary = buildRouteSummary(route);
  const stops = summary.stops;
  if (!stops.length) return [];

  const totalMinutes = summary.durationMinutes || Math.max(stops.length * 6, 12);
  const stepMinutes = stops.length > 1 ? totalMinutes / (stops.length - 1) : totalMinutes;

  return stops.map((stop, index) => {
    const explicitLabel = stop?.arrival_time || stop?.departure_time || stop?.eta_label || stop?.scheduled_time;
    const etaMinutes = Math.max(0, Math.round(index * stepMinutes));
    const isFirst = index === 0;
    const isLast = index === stops.length - 1;

    return {
      ...stop,
      sequence: index + 1,
      arrivalLabel: explicitLabel || `+${etaMinutes} min`,
      status: stop?.status || (isFirst ? "origin" : isLast ? "destination" : "upcoming"),
      isBoardingPoint: Boolean(stop?.is_boarding_point || stop?.pickup_allowed || stop?.boarding || isFirst),
      coord: getCoord(stop),
    };
  });
};
