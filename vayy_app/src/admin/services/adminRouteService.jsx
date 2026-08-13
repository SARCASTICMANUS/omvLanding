import API from "../../shared/lib/api";
import { ADMIN } from "../../constants";

export const fetchRoutesAPI = async () => {
  const res = await API.get(ADMIN.routes);
  return res.data?.data ?? res.data;
};

export const createRouteAPI = async (data) => {
  const res = await API.post(ADMIN.routes, data);
  return res.data?.data ?? res.data;
};

export const updateRouteAPI = async (id, data) => {
  const res = await API.put(`${ADMIN.routes}${id}/`, data);
  return res.data?.data ?? res.data;
};

export const deleteRouteAPI = async (id) => {
  await API.delete(`${ADMIN.routes}${id}/`);
  return id;
};