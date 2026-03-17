// VAYY | src/utils/api.js | Status: 🔧 Fixed
// Reason: Added 401 interceptor for automatic access token refresh handling.
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

// 1. Request Interceptor: Attach Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
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
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (refreshToken) {
        try {
          const res = await axios.post(
            (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api/auth/refresh/",
            { refresh: refreshToken }
          );
          
          if (res.data.access) {
            localStorage.setItem("token", res.data.access);
            originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
            return api(originalRequest); // retry original
          }
        } catch (refreshError) {
          // refresh token invalid/expired -> clear and logout
        }
      }

      // If we got here, refresh failed or doesn't exist. Clear auth and redirect.
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    
    return Promise.reject(error);
  },
);

export default api;
