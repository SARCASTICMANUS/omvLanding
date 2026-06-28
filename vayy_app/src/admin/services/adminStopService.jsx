import API from "../../shared/lib/api";
import { ADMIN } from "../../constants";

// GET stops
export const fetchStopsAPI = async () => {
  const res = await API.get(ADMIN.stops);
  return res.data;
};

// CREATE stop
export const createStopAPI = async (data) => {
  const res = await API.post(ADMIN.stops, data);
  return res.data;
};