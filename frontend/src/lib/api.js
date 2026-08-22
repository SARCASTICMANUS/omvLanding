// VAYY | src/utils/api.js | Status: 🔧 Fixed
// Reason: Added 401 interceptor for automatic access token refresh handling.
import axios from "axios";
import { store } from "../app/store";
import { logout, refreshTokenSuccess } from "../features/auth/authSlice";
import { API_PATHS } from "../constants/apiPaths";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

// 1. Request Interceptor: Attach Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 2. Response Interceptor: Refresh Token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and we haven't already retried this request
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      
      if (refreshToken) {
        try {
          const res = await axios.post(
            (import.meta.env.VITE_API_URL || "http://localhost:8000") + API_PATHS.auth.refresh,
            { refresh: refreshToken }
          );
          
          if (res.data.access) {
            localStorage.setItem("access_token", res.data.access);
            store.dispatch(refreshTokenSuccess({ token: res.data.access }));
            originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
            return api(originalRequest); // retry original
          }
        } catch {
          // refresh token invalid/expired -> clear and logout
        }
      }

      // If we got here, refresh failed or doesn't exist. Clear auth.
      // App.jsx will handle the redirect because isAuthenticated will become false.
      store.dispatch(logout());
    }
    
    return Promise.reject(error);
  },
);

export const getWsUrl = (path) => {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
  const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = baseUrl.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${wsHost}${path}`;
};

export default api;
