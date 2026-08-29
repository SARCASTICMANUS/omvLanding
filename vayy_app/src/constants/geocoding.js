import api from "../shared/lib/api";

const GEOCODE_SEARCH = "/api/transport/geocode/search/";
const GEOCODE_REVERSE = "/api/transport/geocode/reverse/";

export const NOMINATIM_SEARCH = async (query, limit = 5) => {
  const res = await api.get(GEOCODE_SEARCH, {
    params: { q: query, limit, countrycodes: "in" },
  });
  return res.data;
};

export const NOMINATIM_REVERSE = async (lat, lon) => {
  const res = await api.get(GEOCODE_REVERSE, {
    params: { lat, lon },
  });
  return res.data;
};

export const USER_AGENT = "VayyTransit/1.0";
