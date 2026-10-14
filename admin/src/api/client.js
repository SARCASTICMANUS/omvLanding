import axios from "axios";
import { ADMIN_CONSOLE_URL } from "../constants/paths";

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
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = localStorage.getItem("admin_refresh");
      if (refresh) {
        try {
          const res = await axios.post(
            `${API_BASE}/accounts/token/refresh/`,
            { refresh }
          );
          if (res.data.access) {
            localStorage.setItem("admin_token", res.data.access);
            if (res.data.refresh) {
              localStorage.setItem("admin_refresh", res.data.refresh);
            }
            originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
            return api(originalRequest);
          }
        } catch {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_refresh");
          // ADMIN_CONSOLE_URL, not a hardcoded "/zxcv". With this app mounted
          // at /zxcv/, a bare "/zxcv" resolves inside the router to "/" — which
          // is the LANDING page, so a token expiry dumped the user on the
          // marketing hero instead of the login screen.
          window.location.href = ADMIN_CONSOLE_URL;
        }
      } else {
        localStorage.removeItem("admin_token");
        window.location.href = ADMIN_CONSOLE_URL;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
