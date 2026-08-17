import { API_URL } from "../shared/lib/api";

const GEOCODE_SEARCH = `${API_URL}/api/transport/geocode/search/`;
const GEOCODE_REVERSE = `${API_URL}/api/transport/geocode/reverse/`;

export const NOMINATIM_SEARCH = async (query, limit = 5) => {
  const url = `${GEOCODE_SEARCH}?q=${encodeURIComponent(query)}&limit=${limit}&countrycodes=in`;
  const res = await fetch(url);
  return res.json();
};

export const NOMINATIM_REVERSE = async (lat, lon) => {
  const url = `${GEOCODE_REVERSE}?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  return res.json();
};

export const USER_AGENT = "VayyTransit/1.0";
