// Local data adapter for the Zone module.
//
// The Zone module is FRONTEND ONLY. It reuses real route data when the API is
// reachable (same endpoints as the Routes page), and falls back to a small
// local mock dataset so the UI can be demonstrated without a backend.
//
// Route shape matches RouteListSerializer:
//   { id, name, route_code, start_name, end_name, total_distance_meters, ... }
// Stop shape matches StopSerializer + optional cumulative fields:
//   { id, name, order, location, cumulative_distance_m, cumulative_duration_s }

import api from "../api/client";

const luknowCoords = (lat, lon) => ({
  type: "Point",
  coordinates: [lon, lat],
});

export const MOCK_ROUTES = [
  {
    id: "mock-route-1",
    name: "High Court → BBD",
    route_code: "VR-01",
    start_name: "High Court",
    end_name: "BBD",
    total_distance_meters: 20000,
    is_public: true,
    stops: [
      { id: "mock-s1", name: "High Court", order: 0, location: luknowCoords(26.8467, 80.9462), cumulative_distance_m: 0, cumulative_duration_s: 0 },
      { id: "mock-s2", name: "Kamta", order: 1, location: luknowCoords(26.8784, 80.9891), cumulative_distance_m: 4200, cumulative_duration_s: 540 },
      { id: "mock-s3", name: "Chinhat", order: 2, location: luknowCoords(26.8984, 81.0178), cumulative_distance_m: 8700, cumulative_duration_s: 1020 },
      { id: "mock-s4", name: "Malhaur", order: 3, location: luknowCoords(26.9199, 81.0507), cumulative_distance_m: 13500, cumulative_duration_s: 1620 },
      { id: "mock-s5", name: "BBD", order: 4, location: luknowCoords(26.9336, 81.0712), cumulative_distance_m: 20000, cumulative_duration_s: 2520 },
    ],
  },
  {
    id: "mock-route-2",
    name: "High Court → SRMU",
    route_code: "VR-02",
    start_name: "High Court",
    end_name: "SRMU",
    total_distance_meters: 12500,
    is_public: true,
    stops: [
      { id: "mock-r2-s1", name: "High Court", order: 0, location: luknowCoords(26.8467, 80.9462), cumulative_distance_m: 0, cumulative_duration_s: 0 },
      { id: "mock-r2-s2", name: "Hazratganj", order: 1, location: luknowCoords(26.8554, 80.9495), cumulative_distance_m: 2100, cumulative_duration_s: 270 },
      { id: "mock-r2-s3", name: "Charbagh", order: 2, location: luknowCoords(26.8321, 80.9194), cumulative_distance_m: 5800, cumulative_duration_s: 720 },
      { id: "mock-r2-s4", name: "Alambagh", order: 3, location: luknowCoords(26.7905, 80.8864), cumulative_distance_m: 9500, cumulative_duration_s: 1170 },
      { id: "mock-r2-s5", name: "SRMU", order: 4, location: luknowCoords(26.7642, 80.8598), cumulative_distance_m: 12500, cumulative_duration_s: 1560 },
    ],
  },
  {
    id: "mock-route-3",
    name: "SRMU → SGPGI",
    route_code: "VR-03",
    start_name: "SRMU",
    end_name: "SGPGI",
    total_distance_meters: 14000,
    is_public: true,
    stops: [
      { id: "mock-r3-s1", name: "SRMU", order: 0, location: luknowCoords(26.7642, 80.8598), cumulative_distance_m: 0, cumulative_duration_s: 0 },
      { id: "mock-r3-s2", name: "Amausi", order: 1, location: luknowCoords(26.7606, 80.8897), cumulative_distance_m: 3100, cumulative_duration_s: 420 },
      { id: "mock-r3-s3", name: "Transport Nagar", order: 2, location: luknowCoords(26.7833, 80.9184), cumulative_distance_m: 7200, cumulative_duration_s: 900 },
      { id: "mock-r3-s4", name: "Jankipuram", order: 3, location: luknowCoords(26.8496, 80.9298), cumulative_distance_m: 11200, cumulative_duration_s: 1380 },
      { id: "mock-r3-s5", name: "SGPGI", order: 4, location: luknowCoords(26.8682, 80.9468), cumulative_distance_m: 14000, cumulative_duration_s: 1740 },
    ],
  },
  {
    id: "mock-route-4",
    name: "Kamta → BBD",
    route_code: "VR-04",
    start_name: "Kamta",
    end_name: "BBD",
    total_distance_meters: 15800,
    is_public: true,
    stops: [
      { id: "mock-r4-s1", name: "Kamta", order: 0, location: luknowCoords(26.8784, 80.9891), cumulative_distance_m: 0, cumulative_duration_s: 0 },
      { id: "mock-r4-s2", name: "Chinhat", order: 1, location: luknowCoords(26.8984, 81.0178), cumulative_distance_m: 4500, cumulative_duration_s: 570 },
      { id: "mock-r4-s3", name: "Malhaur", order: 2, location: luknowCoords(26.9199, 81.0507), cumulative_distance_m: 9300, cumulative_duration_s: 1140 },
      { id: "mock-r4-s4", name: "Indira Nagar", order: 3, location: luknowCoords(26.9096, 81.0039), cumulative_distance_m: 12400, cumulative_duration_s: 1530 },
      { id: "mock-r4-s5", name: "BBD", order: 4, location: luknowCoords(26.9336, 81.0712), cumulative_distance_m: 15800, cumulative_duration_s: 1950 },
    ],
  },
];

const isApiData = (data) => Array.isArray(data) && data.length > 0;

export async function fetchRoutes() {
  try {
    const res = await api.get("/transport/routes/");
    const data = Array.isArray(res.data) ? res.data : res.data.results;
    if (isApiData(data)) return data;
  } catch {
    // API unreachable — fall back to mock below.
  }
  return MOCK_ROUTES;
}

export async function fetchRouteDetail(routeId) {
  try {
    const res = await api.get(`/transport/routes/${routeId}/`);
    const data = res.data;
    if (data && Array.isArray(data.stops) && data.stops.length) return data;
  } catch {
    // API unreachable — fall back to mock below.
  }
  const mock = MOCK_ROUTES.find((r) => String(r.id) === String(routeId));
  if (mock) return mock;
  return null;
}
