export const NOMINATIM_SEARCH = (query, limit = 5) =>
  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}`;

export const NOMINATIM_REVERSE = (lat, lon) =>
  `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

export const OSRM_ROUTE = (coords) =>
  `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`;

export const USER_AGENT = "VayyTransit/1.0";
