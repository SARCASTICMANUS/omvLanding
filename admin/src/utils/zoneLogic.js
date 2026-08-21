// Pure helpers for the Zone (stage-based fare) module.
// This module is FRONTEND ONLY. All logic operates on real route/stop data
// shaped like the API responses (RouteListSerializer / StopSerializer).

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ---- Zone defaults -------------------------------------------------------

export const MIN_ZONES = 2;
export const MAX_ZONES = 10;

export const defaultZoneName = (index) => `Zone ${LETTERS[index] || index + 1}`;

export const defaultZoneFare = (index) => (index + 1) * 10;

// ---- Stop ordering / lookup ----------------------------------------------

export const sortStops = (stops) =>
  [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// Compact label for a stop (prefers backend short_name / first segment).
export const shortStopName = (stop) => {
  if (!stop) return "";
  if (stop.short_name) return stop.short_name;
  const first = String(stop.name).split(",")[0].trim();
  return first || stop.name;
};

export const stopIndexById = (stops, id) =>
  stops.findIndex((s) => String(s.id) === String(id));

// ---- Distance + duration derivation --------------------------------------
// Distances are DISPLAY VALUES derived from stop data. Admins never type km.

const EARTH_RADIUS_M = 6371000;

const toRad = (d) => (d * Math.PI) / 180;

function coordsOf(stop) {
  const c = stop?.location?.coordinates;
  if (Array.isArray(c) && c.length >= 2) return [c[0], c[1]];
  if (typeof stop?.lon === "number" && typeof stop?.lat === "number") return [stop.lon, stop.lat];
  return null;
}

export const haversineMeters = (a, b) => {
  const ca = coordsOf(a);
  const cb = coordsOf(b);
  if (!ca || !cb) return 0;
  const dLat = toRad(cb[1] - ca[1]);
  const dLon = toRad(cb[0] - ca[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(ca[1])) * Math.cos(toRad(cb[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
};

// Returns cumulative meters at each stop index along the route.
export const cumulativeDistances = (stops, routeTotalMeters = 0) => {
  const ordered = sortStops(stops);
  const n = ordered.length;
  const cumulative = new Array(n).fill(0);
  if (n <= 1) return cumulative;

  // Prefer the backend's own cumulative values when present.
  if (ordered.every((s) => typeof s.cumulative_distance_m === "number" && s.cumulative_distance_m >= 0)) {
    ordered.forEach((s, i) => (cumulative[i] = s.cumulative_distance_m));
    return cumulative;
  }

  const segments = [];
  for (let i = 0; i < n - 1; i++) {
    segments.push(haversineMeters(ordered[i], ordered[i + 1]));
  }
  const rawTotal = segments.reduce((sum, s) => sum + s, 0);
  const target = Number(routeTotalMeters) > 0 ? Number(routeTotalMeters) : rawTotal;

  if (rawTotal > 0) {
    const scale = target > 0 ? target / rawTotal : 1;
    let acc = 0;
    for (let i = 0; i < n - 1; i++) {
      acc += segments[i] * scale;
      cumulative[i + 1] = acc;
    }
  } else if (target > 0) {
    const each = target / (n - 1);
    for (let i = 1; i < n; i++) cumulative[i] = cumulative[i - 1] + each;
  }
  return cumulative;
};

// Estimated cumulative minutes at each stop (display only).
// Uses backend cumulative_duration_s when present, otherwise derives from
// distance at a ~26.7 km/h average service speed.
export const cumulativeMinutes = (stops, distances) => {
  const hasDurations = stops.every(
    (s) => typeof s.cumulative_duration_s === "number" && s.cumulative_duration_s >= 0
  );
  if (hasDurations) {
    return stops.map((s) => Math.round(s.cumulative_duration_s / 60));
  }
  return distances.map((m) => Math.round(m / (26.7 * 1000 / 60)));
};

export const formatKm = (meters) => {
  const km = Number(meters) / 1000;
  if (!Number.isFinite(km)) return "—";
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
};

// ---- Automatic stop-based division ---------------------------------------

// Divides N stops into `count` contiguous chunks "as evenly as possible",
// distributing the remainder to the earliest zones.
export const divideStopsIntoZones = (stopCount, count) => {
  const zones = [];
  const base = Math.floor(stopCount / count);
  let remainder = stopCount % count;
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    zones.push({ startIdx: cursor, endIdx: cursor + size - 1 });
    cursor += size;
  }
  return zones;
};

// Builds a default zone config for the given stops.
export const buildDefaultZoneConfig = (stops, count) => {
  const ordered = sortStops(stops);
  const n = ordered.length;
  if (n < 2) return [];
  const safeCount = Math.max(MIN_ZONES, Math.min(count, MAX_ZONES, n));
  return divideStopsIntoZones(n, safeCount).map(({ startIdx, endIdx }, i) => ({
    id: `zone-${i + 1}`,
    name: defaultZoneName(i),
    startStopId: ordered[startIdx].id,
    endStopId: ordered[endIdx].id,
    flatFareINR: defaultZoneFare(i),
  }));
};

// ---- Zone boundary helpers -----------------------------------------------

// For zone i, the earliest stop index it may end at (its own start) and the
// latest (must leave at least one stop per following zone).
export const zoneEndRange = (stops, zones, zoneIndex) => {
  const zone = zones[zoneIndex];
  if (!zone) return { minIdx: 0, maxIdx: 0 };
  const startIdx = stopIndexById(stops, zone.startStopId);
  const following = zones.length - zoneIndex - 1;
  const maxIdx = stops.length - 1 - following;
  return { minIdx: Math.max(0, startIdx), maxIdx: Math.max(startIdx, maxIdx) };
};

// ---- Validation -----------------------------------------------------------

export const validateZoneConfig = (stops, zones) => {
  const errors = [];
  const ordered = sortStops(stops);

  if (ordered.length < 2) {
    errors.push("A route must contain at least 2 stops to define zones.");
  }
  if (!zones || zones.length < MIN_ZONES) {
    errors.push("At least 2 zones are required.");
  } else if (zones.length > MAX_ZONES) {
    errors.push(`Maximum ${MAX_ZONES} zones allowed.`);
  }

  const assigned = new Set();
  let prevEndIdx = -1;
  let firstZoneSeen = false;

  (zones || []).forEach((zone, i) => {
    if (!zone.name || !zone.name.trim()) {
      errors.push(`Zone ${i + 1}: name cannot be empty.`);
    }

    const fare = zone.flatFareINR;
    if (fare === "" || fare === null || fare === undefined || !Number.isFinite(Number(fare))) {
      errors.push(`Zone ${i + 1}: please enter a valid fare.`);
    } else if (Number(fare) < 0) {
      errors.push(`Zone ${i + 1}: fare cannot be negative.`);
    }

    const startIdx = stopIndexById(ordered, zone.startStopId);
    const endIdx = stopIndexById(ordered, zone.endStopId);

    if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) {
      errors.push(`Zone ${i + 1}: zone boundaries must follow the route sequence.`);
      return;
    }

    if (i === 0 && startIdx !== 0) {
      errors.push("Zone A must begin with the first route stop.");
    }
    if (i === (zones || []).length - 1 && endIdx !== ordered.length - 1) {
      errors.push("The final zone must contain the final route stop.");
    }
    if (firstZoneSeen && startIdx !== prevEndIdx + 1) {
      errors.push(`Zone boundaries must follow the route sequence.`);
    }

    for (let idx = startIdx; idx <= endIdx; idx++) {
      if (assigned.has(idx)) {
        errors.push(`Stop ${idx + 1} belongs to multiple zones.`);
      }
      assigned.add(idx);
    }
    prevEndIdx = endIdx;
    firstZoneSeen = true;
  });

  for (let i = 0; i < ordered.length; i++) {
    if (!assigned.has(i)) {
      errors.push(`Stop ${i + 1} is not assigned to a zone.`);
    }
  }

  return { valid: errors.length === 0, errors };
};

// ---- Fare examples (frontend demonstration only) -------------------------

export const buildFareExamples = (stops, zones) => {
  const ordered = sortStops(stops);
  if (ordered.length < 2 || !zones?.length) return [];
  return zones.map((zone, i) => {
    const endIdx = stopIndexById(ordered, zone.endStopId);
    const startIdx = stopIndexById(ordered, zone.startStopId);
    return {
      key: `ex-${i}`,
      fromName: ordered[0].name,
      toName: ordered[Math.max(0, endIdx)].name,
      fromStopNo: 1,
      toStopNo: endIdx >= 0 ? endIdx + 1 : "—",
      fromIndex: 0,
      toIndex: endIdx,
      fareINR: Number(zone.flatFareINR),
      zoneName: zone.name,
    };
  });
};
