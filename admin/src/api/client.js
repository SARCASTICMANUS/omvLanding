import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      const refresh = localStorage.getItem("admin_refresh");
      if (refresh) {
        try {
          const res = await axios.post(
            `${API_BASE}/accounts/token/refresh/`,
            { refresh }
          );
          if (res.data.access) {
            localStorage.setItem("admin_token", res.data.access);
            err.config.headers.Authorization = `Bearer ${res.data.access}`;
            return api(err.config);
          }
        } catch {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_refresh");
          window.location.href = "/";
        }
      } else {
        localStorage.removeItem("admin_token");
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
