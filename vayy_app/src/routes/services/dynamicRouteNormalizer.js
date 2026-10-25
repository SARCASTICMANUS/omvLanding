// Mobile port of frontend/src/services/routes/dynamicRouteNormalizer.js
//
// dynamic-preview response  ->  props the EXISTING route cards already read
// (PassengerRouteList.RouteCard, DriverRouteList.RouteCard + buildRouteSummary).
//
// Rules (same as web):
//   * distance / ETA / fare are copied from the backend, never computed here;
//   * stop order is the backend's order (sequence mirrored into `order`);
//   * nothing is invented: missing data stays null / neutral text.
//
// Mobile-only rule (integration plan 4.2): MIRROR-BUG GUARD. Geometry is
// GeoJSON [lng, lat]; a lat/lng swap puts every vertex far outside India
// (lat ~77-81 is fine as a latitude, but lng ~26-28 is not a valid Indian
// longitude). So the guard checks INDIA's bounds, not one city's: it used to be
// a Lucknow-only box (lat 26.5-27.1, lng 80.6-81.2) which silently dropped every
// route in any other city (Noida, 28.5N 77.3E, came back as an empty list).
// A route that fails is dropped, not repaired.

export const DYNAMIC_ROUTE_SOURCE = "dynamic";
export const DYNAMIC_ROUTE_CODE_LABEL = "YOUR ROUTE";

const SERVICE_AREA = { latMin: 6.0, latMax: 37.5, lngMin: 68.0, lngMax: 98.0 };

const insideServiceArea = (lng, lat) =>
  lat >= SERVICE_AREA.latMin &&
  lat <= SERVICE_AREA.latMax &&
  lng >= SERVICE_AREA.lngMin &&
  lng <= SERVICE_AREA.lngMax;

/* ------------------------------------------------------------- primitives */

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const readNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

// Ported from frontend/src/components/map/utils/routeGeometry.js so the mobile
// normalizer resolves coordinate pairs exactly like the web one. "auto" repairs
// a [lat, lng] pair instead of silently flipping it; on the canonical GeoJSON
// [lng, lat] payload it is a no-op (|lng| > 35 wins).
const isLikelyLonLat = ([first, second]) =>
  Math.abs(first) > 35 || Math.abs(second) <= 35;

const normalizeCoordinate = (coord, fallbackOrder = "lonLat") => {
  if (!Array.isArray(coord) || coord.length < 2) return null;

  const first = toNumber(coord[0]);
  const second = toNumber(coord[1]);
  if (first === null || second === null) return null;

  if (fallbackOrder === "latLon") return [second, first];
  if (fallbackOrder === "lonLat") return [first, second];

  return isLikelyLonLat([first, second]) ? [first, second] : [second, first];
};

const shortLabel = (value, fallback = "") => {
  if (!value) return fallback;
  const base = String(value).split(",")[0].trim();
  return base || fallback;
};

const formatDistanceLabel = (meters) => {
  if (meters === null || meters <= 0) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
};

const formatDurationLabel = (seconds) => {
  if (seconds === null || seconds <= 0) return null;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

/* --------------------------------------------------------------- envelope */

const unwrapEnvelope = (payload) => {
  if (!payload || typeof payload !== "object") return {};
  if (Array.isArray(payload)) return { routes: payload };
  const nested = payload.data ?? payload.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested;
  return payload;
};

export const extractDynamicRoutePayloads = (payload) => {
  const containers = [];

  if (Array.isArray(payload)) {
    containers.push(payload);
  } else if (payload && typeof payload === "object") {
    containers.push(payload);
    for (const key of ["data", "result", "payload"]) {
      const nested = payload[key];
      if (Array.isArray(nested)) return nested;
      if (nested && typeof nested === "object") containers.push(nested);
    }
  }

  for (const body of containers) {
    if (Array.isArray(body)) {
      if (body.length > 0) return body;
      continue;
    }
    const list =
      (Array.isArray(body.routes) && body.routes) ||
      (Array.isArray(body.candidates) && body.candidates) ||
      (Array.isArray(body.dynamic_routes) && body.dynamic_routes) ||
      (Array.isArray(body.results) && body.results) ||
      null;
    if (list && list.length > 0) return list;
    if (body.route || body.dynamic_route) return [body];
  }

  return [];
};

/* --------------------------------------------------------------- geometry */

// Google encoded polyline (precision 5) -> [[lat, lng], ...]
const decodePolyline = (encoded, precision = 5) => {
  const factor = Math.pow(10, precision);
  const out = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length + 1);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    out.push([lat / factor, lng / factor]);
  }
  return out;
};

// Always returns [[lng, lat], ...]
export const resolveGeometryCoordinates = (geometry) => {
  if (!geometry) return [];

  if (typeof geometry === "string") {
    const trimmed = geometry.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return resolveGeometryCoordinates(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
    try {
      return decodePolyline(trimmed)
        .map(([lat, lng]) => [lng, lat])
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  if (Array.isArray(geometry)) {
    const first = geometry[0];
    if (Array.isArray(first) || (first && typeof first === "object" && "lat" in first)) {
      return geometry
        .map((coord) => {
          if (Array.isArray(coord)) return normalizeCoordinate(coord, "auto");
          const lat = toNumber(coord?.lat ?? coord?.latitude);
          const lng = toNumber(coord?.lng ?? coord?.lon ?? coord?.longitude);
          if (lat === null || lng === null) return null;
          return [lng, lat];
        })
        .filter(Boolean);
    }
    return [];
  }

  if (Array.isArray(geometry.coordinates)) return resolveGeometryCoordinates(geometry.coordinates);
  if (geometry.geometry) return resolveGeometryCoordinates(geometry.geometry);
  return [];
};

/* ---------------------------------------------------- points / stops / fare */

const readPoint = (point) => {
  const lat = toNumber(point?.lat ?? point?.latitude ?? point?.y);
  const lng = toNumber(point?.lng ?? point?.lon ?? point?.longitude ?? point?.x);
  if (lat === null || lng === null) return null;
  return {
    ...(point || {}),
    label: shortLabel(point?.label ?? point?.name ?? point?.address, ""),
    lat,
    lng,
    lon: lng,
  };
};

const readStop = (stop, index, fallbackName) => {
  const coordinates = Array.isArray(stop?.location?.coordinates) ? stop.location.coordinates : null;

  const lat = readNumber(stop?.lat, stop?.latitude, stop?.location?.lat, coordinates?.[1]);
  const lon = readNumber(stop?.lon, stop?.lng, stop?.longitude, stop?.location?.lon, coordinates?.[0]);

  const id = stop?.id ?? stop?.stop_id ?? null;
  const sequence = readNumber(stop?.sequence, stop?.order, index + 1) ?? index + 1;
  const name = String(stop?.name || stop?.stop_name || stop?.label || stop?.address || "").trim();

  return {
    ...stop,
    id,
    stop_id: stop?.stop_id ?? id,
    name: name || fallbackName || `OMV Stop ${sequence}`,
    sequence,
    order: sequence,
    distance_along_route_m: readNumber(stop?.distance_along_route_m, stop?.distance_along_route),
    lat,
    lon,
    lng: lon,
    is_boarding_point: Boolean(stop?.is_boarding_point ?? stop?.pickup_allowed),
    pickup_allowed: Boolean(stop?.pickup_allowed ?? stop?.is_boarding_point),
  };
};

const readStops = (body, route) => {
  const rawStops =
    (Array.isArray(body?.stops) && body.stops) ||
    (Array.isArray(route?.stops) && route.stops) ||
    (Array.isArray(body?.route_stops) && body.route_stops) ||
    [];
  const unnamedCount = rawStops.filter((stop) =>
    !String(stop?.name || stop?.stop_name || stop?.label || stop?.address || "").trim()
  ).length;
  let unnamedIndex = 0;
  return rawStops.map((stop, index) => {
    const unnamed = !String(stop?.name || stop?.stop_name || stop?.label || stop?.address || "").trim();
    const fallbackName = unnamed
      ? unnamedCount === 1 ? "Nearest OMV Stop" : `OMV Stop ${++unnamedIndex}`
      : null;
    return readStop(stop, index, fallbackName);
  }); // backend order, never re-sorted
};

const readFarePayload = (fare) => {
  if (fare === null || fare === undefined) return null;

  if (typeof fare !== "object") {
    const amount = toNumber(fare);
    if (amount === null) return null;
    return { total: amount, buddy_fare: amount, marshal_earning: amount, currency: "INR" };
  }

  const total = readNumber(fare.total, fare.total_fare, fare.amount, fare.fare);
  const buddyFare = readNumber(
    fare.buddy_fare, fare.passenger_fare, fare.rider_fare, fare.price, fare.fare, total
  );
  const marshalEarning = readNumber(
    fare.marshal_earning, fare.driver_fare, fare.driver_earning, fare.earnings, fare.buddy_fare, total
  );

  if (buddyFare === null && marshalEarning === null && total === null) return null;

  return {
    total,
    buddy_fare: buddyFare,
    marshal_earning: marshalEarning,
    currency: fare.currency || "INR",
    distance_km: readNumber(fare.distance_km),
    per_km: readNumber(fare.per_km, fare.per_km_charge, fare.rate_per_km),
  };
};

const fareForAudience = (farePayload, audience) => {
  if (!farePayload) return null;
  return audience === "passenger"
    ? (farePayload.buddy_fare ?? farePayload.total)
    : (farePayload.marshal_earning ?? farePayload.total);
};

/* ----------------------------------------------------------------- mapper */

export const normalizeDynamicRoute = (payload, options = {}) => {
  const {
    audience = "driver",
    isBest = false,
    origin = null,
    destination = null,
    cityLabel = "",
  } = options;

  const body = unwrapEnvelope(payload);
  const route = body.route ?? body.dynamic_route ?? {};
  const stops = readStops(body, route);

  const startPoint = readPoint(route.start ?? route.origin ?? origin);
  const destinationPoint = readPoint(route.destination ?? route.end ?? route.to ?? destination);

  const distanceMeters = readNumber(
    route.distance_m, route.distance_meters, route.total_distance_meters,
    route.total_distance, route.distance, body.distance_m
  );
  const durationSeconds = readNumber(
    route.duration_s, route.duration_seconds, route.eta_seconds, route.duration, body.duration_s
  );

  const distanceKm = distanceMeters === null ? null : distanceMeters / 1000;
  const durationMinutes =
    durationSeconds === null ? null : Math.max(1, Math.ceil(durationSeconds / 60));

  // journey_id == id == dynamic_route_id (plan: never null once persisted)
  const dynamicRouteId =
    route.id ?? body.dynamic_route_id ?? body.journey_id ?? route.journey_id ?? null;

  const farePayload = readFarePayload(body.fare ?? route.fare);
  const fare = fareForAudience(farePayload, audience);

  const startLabel = shortLabel(startPoint?.label || stops[0]?.name, "Start");
  const destinationLabel = shortLabel(
    destinationPoint?.label || stops[stops.length - 1]?.name,
    "Destination"
  );
  const titleLabel =
    shortLabel(route.title ?? body.title ?? route.name, "") ||
    shortLabel(cityLabel, "") ||
    "Live on-road route";

  const coordinates = resolveGeometryCoordinates(
    route.geometry ?? route.route_geometry ?? route.path_coords ?? route.path ?? body.geometry
  );

  // MIRROR-BUG GUARD: a route with any vertex outside India is dropped.
  if (coordinates.length > 0 && !coordinates.every(([lng, lat]) => insideServiceArea(lng, lat))) {
    console.warn("[dynamicRoute] dropped route: geometry outside India bounds (mirror-bug guard)");
    return null;
  }

  const stopCount = readNumber(body.stop_count, body.stops_count) ?? stops.length;

  const toStopRef = (point, fallbackName) => {
    if (!point) return null;
    return {
      id: null,
      stop_id: null,
      name: point.label || fallbackName,
      lat: point.lat,
      lon: point.lon,
      lng: point.lng,
    };
  };

  const hasCoords = (value) =>
    toNumber(value?.lat) !== null && toNumber(value?.lon ?? value?.lng) !== null;

  const withEndpointCoords = (stop, point, fallbackName) => {
    if (!stop) return toStopRef(point, fallbackName);
    if (hasCoords(stop) || !point) return stop;
    return { ...stop, lat: point.lat, lon: point.lon, lng: point.lng };
  };

  const boardingStop = withEndpointCoords(
    (Array.isArray(body.pickup_stop) ? null : body.pickup_stop) || body.boarding_stop || stops[0],
    startPoint,
    "Pickup Point"
  );
  const alightingStop = withEndpointCoords(
    (Array.isArray(body.dropoff_stop) ? null : body.dropoff_stop) ||
      body.alighting_stop ||
      stops[stops.length - 1],
    destinationPoint,
    "Drop-off Point"
  );

  return {
    id: dynamicRouteId,
    route_id: dynamicRouteId,
    dynamic_route_id: dynamicRouteId,
    journey_id: dynamicRouteId,
    source: DYNAMIC_ROUTE_SOURCE,
    route_source: route.route_source ?? body.route_source ?? DYNAMIC_ROUTE_SOURCE,
    city_id: route.city_id ?? body.city_id ?? null,
    max_walk_to_stop_meters: readNumber(route.max_walk_to_stop_m),
    generated_from_global_stops: route.route_source === "osrm_global_stops" || body.route_source === "osrm_global_stops",
    first_mile_proximity_meters: readNumber(route.first_mile_proximity_meters, body.first_mile_proximity_meters),
    last_mile_proximity_meters: readNumber(route.last_mile_proximity_meters, body.last_mile_proximity_meters),
    type: DYNAMIC_ROUTE_SOURCE,
    city: cityLabel || null,
    vehicle_type: body.vehicle_type || null,
    is_best_match: Boolean(isBest),

    name: titleLabel,
    route_name: titleLabel,
    title: titleLabel,
    code: DYNAMIC_ROUTE_CODE_LABEL,
    route_code: DYNAMIC_ROUTE_CODE_LABEL,
    source_name: startLabel,
    start_name: startLabel,
    destination_name: destinationLabel,
    end_name: destinationLabel,

    start: startPoint,
    destination: destinationPoint,

    geometry: route.geometry ?? route.route_geometry ?? null,
    route_geometry: coordinates,
    path_coords: coordinates,
    previewPath: coordinates,

    distance_m: distanceMeters,
    duration_s: durationSeconds,
    distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
    total_distance: distanceMeters,
    total_distance_meters: distanceMeters,
    distance_meters: distanceMeters,
    distance_text: formatDistanceLabel(distanceMeters),
    duration_seconds: durationSeconds,
    eta_seconds: durationSeconds,
    duration_minutes: durationMinutes,
    duration_text: formatDurationLabel(durationSeconds),

    stops,
    stop_count: stopCount,
    stops_count: stopCount,

    pickup_stop: boardingStop || null,
    dropoff_stop: alightingStop || null,
    pickup_stop_id: boardingStop?.id ?? boardingStop?.stop_id ?? null,
    drop_stop_id: alightingStop?.id ?? alightingStop?.stop_id ?? null,
    first_mile_walk_meters: readNumber(body.first_mile_walk_meters, boardingStop?.distance_meters),
    last_mile_walk_meters: readNumber(body.last_mile_walk_meters, alightingStop?.distance_to_destination_meters),
    walking_path: body.walking_path ?? route.walking_path ?? null,
    walking_directions_available:
      route.walking_directions_available ?? body.walking_directions_available ?? null,
    first_mile: route.first_mile ?? body.first_mile ?? null,
    last_mile: route.last_mile ?? body.last_mile ?? null,
    requested_origin: readPoint(route.requested_origin ?? body.requested_origin ?? origin),
    requested_destination: readPoint(route.requested_destination ?? body.requested_destination ?? destination),

    fare,
    fare_breakdown: farePayload,
    fare_detail: farePayload,

    routeContext: {
      source: DYNAMIC_ROUTE_SOURCE,
      dynamicRouteId,
      geometry: coordinates,
      distance: distanceMeters,
      duration: durationSeconds,
      stops,
      fare: farePayload,
    },
  };
};

// Every real candidate the backend returned, in backend order. [] when none.
export const normalizeDynamicRoutes = (payload, options = {}) => {
  const payloads = extractDynamicRoutePayloads(payload);
  const total = payloads.length;

  return payloads
    .map((entry, index) =>
      normalizeDynamicRoute(entry, {
        ...options,
        isBest: Boolean(options.isBest) || (total > 1 && index === 0),
      })
    )
    .filter(Boolean);
};

/**
 * GeoJSON LineString for a normalized dynamic route, or null when it carries no
 * geometry. Tolerant of every place the geometry can live: the normalizer's own
 * aliases, a raw dynamic-preview payload, or a legacy { path: <geometry> } blob.
 *
 * The pre-ride screens render
 *   <GeoJSONSource id="routeSource" data={routePath} />
 *   <Layer id="routeLayer" type="line" source="routeSource" ... />
 * so without a LineString here the route line never draws - the Layer alone is
 * invisible.
 */
export const toRouteGeoJSON = (source) => {
  if (!source || typeof source !== "object") return null;

  // Already a GeoJSON geometry/feature - pass through once validated.
  if (source.type === "Feature" && source.geometry) {
    return toRouteGeoJSON(source.geometry);
  }
  if (source.type === "LineString" && Array.isArray(source.coordinates)) {
    return source.coordinates.length ? source : null;
  }

  const coordinates = resolveGeometryCoordinates(
    source.route_geometry ??
      source.previewPath ??
      source.path_coords ??
      source.geometry ??
      source.path ??
      source.route?.geometry ??
      source.routeContext?.geometry ??
      null
  );
  if (!coordinates.length) return null;
  return { type: "LineString", coordinates };
};

export default normalizeDynamicRoutes;
