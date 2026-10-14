// VAYY | src/services/routes/dynamicRouteNormalizer.js | Status: 🆕 Dynamic route creation
//
// ============================================================================
// COMPATIBILITY MAPPER — dynamic route API response -> EXISTING Route Card props
// ============================================================================
//
// The existing Route Cards are NOT rewritten. They already understand a route
// object carrying `total_distance`, `eta_seconds`, `stops`, `route_code`,
// `name`, `fare` and `route_geometry` (see buildRouteSummary in
// src/driver/components/driverFlowUtils.js and RouteCard in
// src/features/passenger/components/PassengerRouteList.jsx).
//
// So this mapper emits a superset of that legacy shape, built entirely from the
// backend's dynamic-route response, plus the canonical `dynamic` fields the
// Continue button forwards downstream.
//
// Hard rules enforced here:
//   * Distance / ETA / fare are copied from the backend. Nothing is measured,
//     estimated or priced in the browser.
//   * Stop order is the backend's order. We mirror `sequence` into `order` so
//     the card's existing stable sort is an identity operation. We never sort
//     by latitude, longitude, name or distance.
//   * Nothing is invented. Missing labels fall back to neutral text, and a
//     missing route identifier stays null rather than being fabricated.
// ============================================================================

import { decodePolyline } from "../../maps/utils/geo";
import { normalizeCoordinate } from "../../components/map/utils/routeGeometry";

export const DYNAMIC_ROUTE_SOURCE = "dynamic";

/* A generated route has no legacy route code (e.g. "LKO-14"). The Route Card
   keeps its existing code slot; we fill it with a safe dynamic label instead of
   fabricating a route code. */
export const DYNAMIC_ROUTE_CODE_LABEL = "YOUR ROUTE";

/* --------------------------------------------------------------------------
   Primitive readers
   -------------------------------------------------------------------------- */

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

const shortLabel = (value, fallback = "") => {
  if (!value) return fallback;
  const base = String(value).split(",")[0].trim();
  return base || fallback;
};

/* Presentation-only mirrors of the card formatters. The driver card derives
   these itself via buildRouteSummary(); the passenger card reads the prebuilt
   `*_text` fields, so both screens show identical strings for the same
   backend numbers. No distance is computed here — only formatted. */
const formatDistanceLabel = (meters) => {
  if (meters === null || meters <= 0) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
};

const formatDurationLabel = (seconds) => {
  if (seconds === null || seconds <= 0) return null;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

/* --------------------------------------------------------------------------
   Response envelope — tolerate { data: {...} } and bare payloads
   -------------------------------------------------------------------------- */

const unwrapEnvelope = (payload) => {
  if (!payload || typeof payload !== "object") return {};
  if (Array.isArray(payload)) return { routes: payload };

  const nested = payload.data ?? payload.result;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested;

  return payload;
};

/**
 * Backend candidates, in the order the backend returned them.
 *
 * Tolerates every envelope the OMV backend produces:
 *   { route, stops, fare }                       bare generated route
 *   { data: { route, stops, fare } }             wrapped object
 *   { data: [ { route, ... }, ... ] }            standard {success,message,data} list
 *   { routes | candidates | dynamic_routes | results: [...] }  multiple candidates
 *   [ ... ]                                      bare list
 *
 * Returns [] when the backend produced no route — callers then render the
 * existing empty state rather than fabricating alternatives.
 */
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

/* --------------------------------------------------------------------------
   Geometry — backend OSRM output, never re-requested from the browser
   -------------------------------------------------------------------------- */

/**
 * Accepts every shape OSRM/Django realistically returns and produces
 * MapLibre-ready [lng, lat] pairs:
 *   - encoded polyline string  (precision 5 -> [lat, lng], swapped below)
 *   - GeoJSON LineString        ({ type, coordinates })
 *   - flat array of pairs
 */
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

  if (Array.isArray(geometry.coordinates)) {
    return resolveGeometryCoordinates(geometry.coordinates);
  }

  if (geometry.geometry) {
    return resolveGeometryCoordinates(geometry.geometry);
  }

  return [];
};

/* --------------------------------------------------------------------------
   Points / stops / fare
   -------------------------------------------------------------------------- */

const readPoint = (point) => {
  const lat = toNumber(point?.lat ?? point?.latitude ?? point?.y);
  const lng = toNumber(point?.lng ?? point?.lon ?? point?.longitude ?? point?.x);
  if (lat === null || lng === null) return null;

  return {
    ...(point || {}),
    label: shortLabel(point?.label ?? point?.name ?? point?.address, ""),
    lat,
    lng,
    // `lon` is the dialect the existing card/map helpers read.
    lon: lng,
  };
};

/**
 * Stops keep the backend's order verbatim. `sequence` is preserved and mirrored
 * into `order` so the card's existing sort-by-order is a no-op identity pass.
 */
const readStop = (stop, index) => {
  const coordinates = Array.isArray(stop?.location?.coordinates)
    ? stop.location.coordinates
    : null;

  const lat = readNumber(
    stop?.lat,
    stop?.latitude,
    stop?.location?.lat,
    coordinates?.[1],
  );
  const lon = readNumber(
    stop?.lon,
    stop?.lng,
    stop?.longitude,
    stop?.location?.lon,
    coordinates?.[0],
  );

  const id = stop?.id ?? stop?.stop_id ?? null;
  const sequence = readNumber(stop?.sequence, stop?.order, index + 1) ?? index + 1;

  return {
    ...stop,
    id,
    stop_id: stop?.stop_id ?? id,
    name:
      stop?.name ||
      stop?.stop_name ||
      stop?.label ||
      stop?.address ||
      `Stop ${sequence}`,
    sequence,
    order: sequence,
    distance_along_route_m: readNumber(
      stop?.distance_along_route_m,
      stop?.distance_along_route,
    ),
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

  // .map() only — order is preserved exactly as returned.
  return rawStops.map(readStop);
};

const readFarePayload = (fare) => {
  if (fare === null || fare === undefined) return null;

  if (typeof fare !== "object") {
    const amount = toNumber(fare);
    if (amount === null) return null;
    return {
      total: amount,
      buddy_fare: amount,
      marshal_earning: amount,
      currency: "INR",
    };
  }

  const total = readNumber(
    fare.total,
    fare.total_fare,
    fare.amount,
    fare.fare,
  );
  const buddyFare = readNumber(
    fare.buddy_fare,
    fare.passenger_fare,
    fare.rider_fare,
    fare.price,
    fare.fare,
    total,
  );
  const marshalEarning = readNumber(
    fare.marshal_earning,
    fare.driver_fare,
    fare.driver_earning,
    fare.earnings,
    fare.buddy_fare,
    total,
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

/* The cards already render a single scalar in the fare slot:
   DriverRouteList "Earnings" -> marshal earning, PassengerRouteList "Est. Fare"
   -> buddy fare. Pick the audience-relevant backend value. */
const fareForAudience = (farePayload, audience) => {
  if (!farePayload) return null;
  return audience === "passenger"
    ? (farePayload.buddy_fare ?? farePayload.total)
    : (farePayload.marshal_earning ?? farePayload.total);
};

/* --------------------------------------------------------------------------
   The mapper
   -------------------------------------------------------------------------- */

/**
 * dynamic route API response
 *        ↓
 * normalizeDynamicRoute(payload, options)
 *        ↓
 * existing Route Card props (superset of the legacy route shape)
 *
 * @param payload  raw axios `response.data` (envelope tolerated)
 * @param options  { audience: "driver" | "passenger", isBest, origin, destination, cityLabel }
 */
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
  const destinationPoint = readPoint(
    route.destination ?? route.end ?? route.to ?? destination,
  );

  /* Authoritative metrics — straight from the backend's OSRM result. */
  const distanceMeters = readNumber(
    route.distance_m,
    route.distance_meters,
    route.total_distance_meters,
    route.total_distance,
    route.distance,
    body.distance_m,
  );
  const durationSeconds = readNumber(
    route.duration_s,
    route.duration_seconds,
    route.eta_seconds,
    route.duration,
    body.duration_s,
  );

  const distanceKm = distanceMeters === null ? null : distanceMeters / 1000;
  const durationMinutes =
    durationSeconds === null ? null : Math.max(1, Math.ceil(durationSeconds / 60));

  /* Never fabricated: null when the backend returns no persisted journey yet. */
  const dynamicRouteId =
    route.id ??
    body.dynamic_route_id ??
    body.journey_id ??
    route.journey_id ??
    null;

  const farePayload = readFarePayload(body.fare ?? route.fare);
  const fare = fareForAudience(farePayload, audience);

  const startLabel = shortLabel(
    startPoint?.label || stops[0]?.name,
    "Start",
  );
  const destinationLabel = shortLabel(
    destinationPoint?.label || stops[stops.length - 1]?.name,
    "Destination",
  );

  const titleLabel =
    shortLabel(route.title ?? body.title ?? route.name, "") ||
    shortLabel(cityLabel, "") ||
    "Live on-road route";

  const coordinates = resolveGeometryCoordinates(
    route.geometry ?? route.route_geometry ?? route.path_coords ?? route.path ?? body.geometry,
  );

  const stopCount = readNumber(body.stop_count, body.stops_count) ?? stops.length;

  /* Explicit boarding / alighting references keep the downstream passenger
     steps (pre-ride, searching) working on the same contract they always used. */
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

  /* Corridor stops are returned with their own id/name/order but not always with
     coordinates. The pre-ride and searching screens read lat/lon straight off
     these references, so when a stop carries none we borrow the coordinates the
     API already resolved for that endpoint. Nothing is invented: the stop's own
     id and name always win, and only the API's own resolved point is used. */
  const hasCoords = (value) =>
    toNumber(value?.lat) !== null && toNumber(value?.lon ?? value?.lng) !== null;

  const withEndpointCoords = (stop, point, fallbackName) => {
    if (!stop) return toStopRef(point, fallbackName);
    if (hasCoords(stop) || !point) return stop;
    return { ...stop, lat: point.lat, lon: point.lon, lng: point.lng };
  };

  const boardingStop = withEndpointCoords(
    (Array.isArray(body.pickup_stop) ? null : body.pickup_stop) ||
      body.boarding_stop ||
      stops[0],
    startPoint,
    "Pickup Point",
  );
  const alightingStop = withEndpointCoords(
    (Array.isArray(body.dropoff_stop) ? null : body.dropoff_stop) ||
      body.alighting_stop ||
      stops[stops.length - 1],
    destinationPoint,
    "Drop-off Point",
  );

  return {
    /* ── identity + provenance ─────────────────────────────────────────── */
    id: dynamicRouteId,
    route_id: dynamicRouteId,
    dynamic_route_id: dynamicRouteId,
    source: DYNAMIC_ROUTE_SOURCE,
    route_source: DYNAMIC_ROUTE_SOURCE,
    type: DYNAMIC_ROUTE_SOURCE,
    city: cityLabel || null,
    vehicle_type: body.vehicle_type || null,
    /* The card shows BEST MATCH only when the backend ranked it best. A single
       generated route is not a "match" against anything. */
    is_best_match: Boolean(isBest),

    /* ── labels consumed by the existing card header ───────────────────── */
    name: titleLabel,
    route_name: titleLabel,
    title: titleLabel,
    code: DYNAMIC_ROUTE_CODE_LABEL,
    route_code: DYNAMIC_ROUTE_CODE_LABEL,
    source_name: startLabel,
    start_name: startLabel,
    destination_name: destinationLabel,
    end_name: destinationLabel,

    /* ── endpoints ─────────────────────────────────────────────────────── */
    start: startPoint,
    destination: destinationPoint,

    /* ── backend geometry (OSRM), consumed by the existing MapLibre preview ── */
    geometry: route.geometry ?? route.route_geometry ?? null,
    route_geometry: coordinates,
    path_coords: coordinates,
    previewPath: coordinates,

    /* ── authoritative OSRM metrics ────────────────────────────────────── */
    distance_m: distanceMeters,
    duration_s: durationSeconds,
    distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
    /* Legacy aliases the existing formatters already read. */
    total_distance: distanceMeters,
    total_distance_meters: distanceMeters,
    distance_meters: distanceMeters,
    distance_text: formatDistanceLabel(distanceMeters),
    duration_seconds: durationSeconds,
    eta_seconds: durationSeconds,
    duration_minutes: durationMinutes,
    duration_text: formatDurationLabel(durationSeconds),

    /* ── ordered corridor stops (backend order, never re-sorted) ────────── */
    stops,
    stop_count: stopCount,
    stops_count: stopCount,

    /* ── boarding / alighting references for the existing downstream steps ── */
    pickup_stop: boardingStop || null,
    dropoff_stop: alightingStop || null,

    /* ── authoritative backend fare ─────────────────────────────────────── */
    fare,
    fare_breakdown: farePayload,
    fare_detail: farePayload,

    /* ── Continue payload: the generated route context, not just an id ──── */
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

/**
 * Every real candidate the backend returned, in backend order.
 * Returns [] when the backend produced no route — callers render the existing
 * empty state rather than fabricating alternatives.
 */
export const normalizeDynamicRoutes = (payload, options = {}) => {
  const payloads = extractDynamicRoutePayloads(payload);
  const total = payloads.length;

  return payloads.map((entry, index) =>
    normalizeDynamicRoute(entry, {
      ...options,
      isBest: Boolean(options.isBest) || total > 1 && index === 0,
    }),
  );
};

export default normalizeDynamicRoutes;
