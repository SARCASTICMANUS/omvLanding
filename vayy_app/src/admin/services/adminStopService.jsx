import API from "../../shared/lib/api";
import { ADMIN } from "../../constants";

export const fetchStopsAPI = async () => {
  const res = await API.get(ADMIN.stops);
  return res.data?.data ?? res.data;
};

export const createStopAPI = async (data) => {
  const res = await API.post(ADMIN.stops, data);
  return res.data?.data ?? res.data;
};