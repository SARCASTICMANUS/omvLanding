import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";

const getApiUrl = () => {
  // Use a hard fallback first, then try to override
  let url = "http://localhost:8000";

  if (process.env.EXPO_PUBLIC_API_URL) {
    url = process.env.EXPO_PUBLIC_API_URL;
  } else if (Constants.expoConfig?.extra?.apiUrl) {
    url = Constants.expoConfig.extra.apiUrl;
  }

  // Ensure it's an absolute URL and doesn't point to the dev server
  if (url.includes("localhost:8081") || url.includes("127.0.0.1:8081")) {
    console.warn("[VAYY] API_URL points to dev server! Falling back to 8000.");
    url = "http://localhost:8000";
  }

  return url;
};

export const API_URL = getApiUrl();

console.log("[VAYY] Initialized API with Base URL:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

let authHandlers = {
  onRefreshToken: null,
  onUnauthorized: null,
};

export const configureAuthHandlers = (handlers) => {
  authHandlers = {
    ...authHandlers,
    ...handlers,
  };
};

const readToken = async () => {
  const token = await AsyncStorage.getItem("token");
  const accessToken = await AsyncStorage.getItem("access_token");

  return token || accessToken;
};

api.interceptors.request.use(
  async (config) => {
    const token = await readToken();

    if (token) {
      config.headers.Authorization = token.startsWith("ey")
        ? `Bearer ${token}`
        : `Token ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    // Check if we received HTML instead of JSON (typical of misrouted requests)
    const contentType = response.headers["content-type"];
    if (contentType && contentType.includes("text/html")) {
      console.warn("API returned HTML instead of JSON. Check your API_URL configuration.");
      return Promise.reject({
        message: "Server returned HTML instead of JSON. Misconfigured API_URL?",
        response,
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = await AsyncStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/api/auth/refresh/`, {
            refresh: refreshToken,
          });
          const nextToken = res.data.access || res.data.token;

          if (nextToken) {
            await AsyncStorage.setItem("access_token", nextToken);
            await AsyncStorage.setItem("token", nextToken);
            authHandlers.onRefreshToken?.({ token: nextToken });
            originalRequest.headers.Authorization = `Bearer ${nextToken}`;
            return api(originalRequest);
          }
        } catch {
          // Logout below when refresh cannot recover the session.
        }
      }

      authHandlers.onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);

export { getWsUrl } from "./wsUrl";
export default api;
