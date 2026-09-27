import {
  getDistance,
  getPreviewOptions,
  getPreviewPath,
  getRoutePath,
  getStopLngLat,
} from "../../components/map/utils/routeGeometry";

export const hasValidCoords = (point) => {
  if (!point || typeof point !== "object") return false;

  const lat = Number(point?.lat ?? point?.latitude ?? point?.y);
  const lon = Number(point?.lon ?? point?.lng ?? point?.longitude ?? point?.x);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat !== 0 &&
    lon !== 0
  );
};

export const normalizeDriverRoutes = (data) => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  if (data.data && data.data !== data) return normalizeDriverRoutes(data.data);
  if (Array.isArray(data.routes)) return data.routes;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.assigned_routes)) return data.assigned_routes;
  if (Array.isArray(data.active_routes)) return data.active_routes;
  return [];
};

const shortPlaceName = (value, fallback = "--") => {
  if (!value) return fallback;
  const base = String(value).split(",")[0].trim();
  if (!base) return fallback;
  return base.length > 26 ? `${base.slice(0, 26).trim()}...` : base;
};

const normalizeStop = (stop, index) => {
  const lat = Number(stop?.lat ?? stop?.latitude ?? stop?.location?.lat ?? stop?.coords?.[1]);
  const lon = Number(stop?.lon ?? stop?.lng ?? stop?.longitude ?? stop?.location?.lon ?? stop?.coords?.[0]);

  return {
    ...stop,
    id: stop?.id || stop?.stop_id || `stop-${index + 1}`,
    name:
      stop?.name ||
      stop?.stop_name ||
      stop?.label ||
      stop?.address ||
      `Stop ${index + 1}`,
    order: Number.isFinite(Number(stop?.order))
      ? Number(stop.order)
      : Number.isFinite(Number(stop?.sequence))
        ? Number(stop.sequence)
        : index,
    lat: Number.isFinite(lat) ? lat : stop?.lat,
    lon: Number.isFinite(lon) ? lon : stop?.lon,
  };
};

export const getOrderedRouteStops = (route) =>
  {
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
      route?.source_name ||
        route?.start_name ||
        route?.origin_name ||
        route?.start_stop_name,
      "",
    );
    const endName = shortPlaceName(
      route?.destination_name ||
        route?.end_name ||
        route?.terminal_name ||
        route?.end_stop_name,
      "",
    );
    const startLat = Number(route?.start?.lat ?? route?.source?.lat ?? route?.origin?.lat);
    const startLon = Number(route?.start?.lon ?? route?.source?.lon ?? route?.origin?.lon);
    const endLat = Number(route?.end?.lat ?? route?.destination?.lat ?? route?.terminal?.lat);
    const endLon = Number(route?.end?.lon ?? route?.destination?.lon ?? route?.terminal?.lon);

    const fallbackStops = [];
    if (startName || (Number.isFinite(startLat) && Number.isFinite(startLon))) {
      fallbackStops.push({
        id: `${route?.id || "route"}-start`,
        name: startName || "Start",
        order: 0,
        lat: Number.isFinite(startLat) ? startLat : undefined,
        lon: Number.isFinite(startLon) ? startLon : undefined,
        is_boarding_point: true,
      });
    }
    if (endName || (Number.isFinite(endLat) && Number.isFinite(endLon))) {
      fallbackStops.push({
        id: `${route?.id || "route"}-end`,
        name: endName || "End",
        order: fallbackStops.length,
        lat: Number.isFinite(endLat) ? endLat : undefined,
        lon: Number.isFinite(endLon) ? endLon : undefined,
      });
    }

    return fallbackStops;
  };

export const getRouteEndpoints = (route) => {
  const stops = getOrderedRouteStops(route);
  const startStop = stops.find((stop) => getStopLngLat(stop));
  const endStop = [...stops].reverse().find((stop) => getStopLngLat(stop));

  if (startStop && endStop) {
    return {
      start: getStopLngLat(startStop),
      end: getStopLngLat(endStop),
    };
  }

  const path = route?.previewPath?.length ? route.previewPath : getRoutePath(route);
  if (path.length > 1) {
    return {
      start: path[0],
      end: path[path.length - 1],
    };
  }

  return { start: null, end: null };
};

const firstTruthy = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

export const formatDistanceText = (route) => {
  const meters = Number(
    firstTruthy(
      route?.total_distance,
      route?.total_distance_meters,
      route?.distance_meters,
      route?.distance,
    ),
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
    firstTruthy(
      route?.total_distance,
      route?.total_distance_meters,
      route?.distance_meters,
      route?.distance,
    ),
  );
  return Number.isFinite(meters) ? meters : 0;
};

export const getDurationMinutes = (route) => {
  const durationMinutes = Number(
    firstTruthy(route?.duration_minutes, route?.eta_minutes),
  );
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

  return {
    active,
    label: active ? "Active" : "Inactive",
  };
};

export const getRouteTitle = (route) =>
  route?.name || route?.route_name || route?.title || `Route ${route?.id || ""}`.trim();

export const getRouteCode = (route) =>
  route?.code ||
  route?.route_code ||
  route?.short_name ||
  route?.route_number ||
  `RT-${route?.id || "--"}`;

export const getBoardingPointCount = (route) =>
  getOrderedRouteStops(route).filter((stop) => stop?.is_boarding_point || stop?.pickup_allowed || stop?.boarding).length;

export const buildRouteSummary = (route) => {
  const stops = getOrderedRouteStops(route);
  const { start, end } = getRouteEndpoints(route);
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
    previewPath: route?.previewPath?.length ? route.previewPath : getRoutePath(route),
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
      startStop?.name ||
        route?.source_name ||
        route?.start_name ||
        route?.origin_name ||
        route?.start_stop_name ||
        (start ? "Start Point" : "--"),
    ),
    endLabel: shortPlaceName(
      endStop?.name ||
        route?.destination_name ||
        route?.end_name ||
        route?.terminal_name ||
        route?.end_stop_name ||
        (end ? "End Point" : "--"),
    ),
    startTimeLabel:
      route?.start_time ||
      route?.departure_time ||
      startStop?.arrival_time ||
      startStop?.departure_time ||
      (startStop ? fallbackArrivalLabel(startStop, 0) : "--") ||
      "--",
    endTimeLabel:
      route?.end_time ||
      route?.arrival_time ||
      endStop?.arrival_time ||
      endStop?.departure_time ||
      (endStop ? fallbackArrivalLabel(endStop, Math.max(stops.length - 1, 0)) : "--") ||
      "--",
    startCoord: start,
    endCoord: end,
  };
};

export const estimateStopTimeline = (route) => {
  const summary = buildRouteSummary(route);
  const stops = summary.stops;
  if (!stops.length) return [];

  const totalMinutes = summary.durationMinutes || Math.max(stops.length * 6, 12);
  const stepMinutes = stops.length > 1 ? totalMinutes / (stops.length - 1) : totalMinutes;

  return stops.map((stop, index) => {
    const explicitLabel =
      stop?.arrival_time ||
      stop?.departure_time ||
      stop?.eta_label ||
      stop?.scheduled_time;

    const etaMinutes = Math.max(0, Math.round(index * stepMinutes));
    const isFirst = index === 0;
    const isLast = index === stops.length - 1;

    return {
      ...stop,
      sequence: index + 1,
      arrivalLabel: explicitLabel || `+${etaMinutes} min`,
      status: stop?.status || (isFirst ? "origin" : isLast ? "destination" : "upcoming"),
      isBoardingPoint: Boolean(stop?.is_boarding_point || stop?.pickup_allowed || stop?.boarding || isFirst),
      coord: getStopLngLat(stop),
    };
  });
};

const calculateNearestStopMatch = (stops, point) => {
  if (!hasValidCoords(point) || !stops.length) return null;

  let best = null;
  stops.forEach((stop, index) => {
    const coord = getStopLngLat(stop);
    if (!coord) return;

    const distance = getDistance([point.lon, point.lat], coord);
    if (!best || distance < best.distance) {
      best = { index, distance, stop };
    }
  });

  return best;
};

export const filterRoutesForDriver = (routes, source, destination) => {
  const summaries = routes.map(buildRouteSummary);
  const sourceQuery = (source?.name || source?.display_name || "").toLowerCase();
  const destinationQuery = (destination?.name || destination?.display_name || "").toLowerCase();

  return summaries
    .map((route) => {
      const stops = getOrderedRouteStops(route);
      const sourceMatch = calculateNearestStopMatch(stops, source);
      const destinationMatch = calculateNearestStopMatch(stops, destination);
      const endpointSource =
        route.startCoord && hasValidCoords(source)
          ? getDistance([source.lon, source.lat], route.startCoord)
          : Infinity;
      const endpointDestination =
        route.endCoord && hasValidCoords(destination)
          ? getDistance([destination.lon, destination.lat], route.endCoord)
          : Infinity;

      const usingStops = sourceMatch && destinationMatch;
      const ordered = usingStops
        ? sourceMatch.index <= destinationMatch.index
        : endpointSource <= 8000 && endpointDestination <= 8000;
      const score = usingStops
        ? sourceMatch.distance + destinationMatch.distance
        : endpointSource + endpointDestination;
      const withinRange = usingStops
        ? sourceMatch.distance <= 5000 && destinationMatch.distance <= 5000
        : endpointSource <= 12000 && endpointDestination <= 12000;
      const stopText = stops
        .map((stop) => `${stop?.name || ""} ${stop?.label || ""}`.toLowerCase())
        .join(" ");
      const routeText = `${route.title} ${route.code} ${route.startLabel} ${route.endLabel}`.toLowerCase();
      const textSourceMatch = sourceQuery ? (routeText.includes(sourceQuery) || stopText.includes(sourceQuery)) : false;
      const textDestinationMatch = destinationQuery ? (routeText.includes(destinationQuery) || stopText.includes(destinationQuery)) : false;
      const textMatched = sourceQuery && destinationQuery ? textSourceMatch && textDestinationMatch : textSourceMatch || textDestinationMatch;
      const coordMatched = hasValidCoords(source) && hasValidCoords(destination)
        ? Boolean(ordered && withinRange)
        : false;
      const matchScore = Number.isFinite(score) ? score : Number.MAX_SAFE_INTEGER;

      return {
        ...route,
        matchScore,
        sourceMatch,
        destinationMatch,
        matchesSearch: Boolean(coordMatched || textMatched),
        textMatched,
        coordMatched,
      };
    })
    .sort((a, b) => {
      if (a.matchesSearch !== b.matchesSearch) return a.matchesSearch ? -1 : 1;
      if (a.status.active !== b.status.active) return a.status.active ? -1 : 1;
      return (a.matchScore || 0) - (b.matchScore || 0);
    });
};

export const mergeRoutePreview = (route, previewData) => {
  const previewOptions = getPreviewOptions(previewData);
  const preview = previewOptions[0];
  const previewPath = getPreviewPath(preview);

  return buildRouteSummary({
    ...route,
    previewPath: previewPath.length ? previewPath : route.previewPath,
    total_distance:
      preview?.distance ||
      preview?.total_distance ||
      route.total_distance ||
      route.total_distance_meters,
  });
};
