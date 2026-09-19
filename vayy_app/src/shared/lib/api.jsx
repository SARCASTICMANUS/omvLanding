import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import { STORAGE_KEYS, AUTH, API_TIMEOUT, DEFAULT_API_URL } from "../../constants";

const getApiUrl = () => {
  let url = DEFAULT_API_URL;

  if (process.env.EXPO_PUBLIC_API_URL) {
    url = process.env.EXPO_PUBLIC_API_URL;
  } else if (Constants.expoConfig?.extra?.apiUrl) {
    url = Constants.expoConfig.extra.apiUrl;
  }

  if (url.includes("localhost:8081") || url.includes("127.0.0.1:8081")) {
    console.warn("[VAYY] API_URL points to dev server! Falling back to 8000.");
    url = DEFAULT_API_URL;
  }

  return url;
};

export const API_URL = getApiUrl();

console.log("[VAYY] Initialized API with Base URL:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
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
  const token = await AsyncStorage.getItem(STORAGE_KEYS.token);
  const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);

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
      const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);

      if (!refreshToken) {
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${API_URL}${AUTH.tokenRefresh}`, {
          refresh: refreshToken,
        });
        const nextToken = res.data.access || res.data.token;

        if (nextToken) {
          await AsyncStorage.setItem(STORAGE_KEYS.accessToken, nextToken);
          await AsyncStorage.setItem(STORAGE_KEYS.token, nextToken);
          authHandlers.onRefreshToken?.({ token: nextToken });
          originalRequest.headers.Authorization = `Bearer ${nextToken}`;
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — fall through to logout
      }

      authHandlers.onUnauthorized?.();
    }

    return Promise.reject(error);
  },
);

export const normalizeApiError = (error, fallbackMessage) => {
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data === "string") return new Error(data);
    if (data.message) return new Error(data.message);
    if (data.detail) return new Error(data.detail);
    if (data.error) return new Error(data.error);
    const firstKey = Object.keys(data)[0];
    if (firstKey && Array.isArray(data[firstKey])) {
      return new Error(data[firstKey][0]);
    }
  }
  return new Error(fallbackMessage || "An unexpected error occurred");
};

export { getWsUrl } from "./wsUrl";
export default api;
