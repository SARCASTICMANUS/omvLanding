import API from "../../shared/lib/api";
import { ADMIN } from "../../constants";

// GET routes
export const fetchRoutesAPI = async () => {
  const res = await API.get(ADMIN.routes);
  return res.data;
};

// CREATE route
export const createRouteAPI = async (data) => {
  const res = await API.post(ADMIN.routes, data);
  return res.data;
};

// UPDATE route
export const updateRouteAPI = async (id, data) => {
  const res = await API.put(`${ADMIN.routes}${id}/`, data);
  return res.data;
};

// DELETE route
export const deleteRouteAPI = async (id) => {
  await API.delete(`${ADMIN.routes}${id}/`);
  return id;
};