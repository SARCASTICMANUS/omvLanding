import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
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

// Single in-flight refresh. Django runs with ROTATE_REFRESH_TOKENS +
// BLACKLIST_AFTER_ROTATION, so the refresh token we just spent is dead the
// moment the server answers. Without this lock, N parallel 401s would each
// POST the same now-blacklisted token; the first succeeds and rotates, the
// rest 401 and drag the user to the login screen. Callers await this promise
// instead of firing their own.
let refreshPromise = null;

const performRefresh = async () => {
  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new Error("No refresh token stored");

  const res = await axios.post(`${API_URL}${AUTH.tokenRefresh}`, { refresh: refreshToken });

  const nextAccess = res.data.access || res.data.token;
  if (!nextAccess) throw new Error("Refresh response contained no access token");

  // SimpleJWT returns a NEW refresh token on every rotation. Persisting it is
  // mandatory — the previous one is already blacklisted.
  const nextRefresh = res.data.refresh || null;

  const writes = [
    AsyncStorage.setItem(STORAGE_KEYS.accessToken, nextAccess),
    AsyncStorage.setItem(STORAGE_KEYS.token, nextAccess),
  ];
  if (nextRefresh) {
    writes.push(AsyncStorage.setItem(STORAGE_KEYS.refreshToken, nextRefresh));
  }
  await Promise.all(writes);

  authHandlers.onRefreshToken?.({ token: nextAccess, refreshToken: nextRefresh });
  return nextAccess;
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

      // Join an in-flight refresh rather than starting a competing one.
      if (!refreshPromise) {
        refreshPromise = performRefresh()
          .catch((refreshError) => {
            // Refresh is unrecoverable — the stored token is spent or revoked.
            // `logout` clears token/accessToken/refreshToken/user/pendingEmail.
            // This sits on the shared promise so a burst of concurrent 401s
            // logs the user out once, not once per failed request.
            authHandlers.onUnauthorized?.();
            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const nextToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return api(originalRequest);
      } catch {
        // Reject with the original 401 so callers see the real failure, not the
        // refresh error. The shared promise above has already logged out.
      }
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

// DRF list endpoints answer with a paginated envelope, and the admin viewsets
// wrap that again in { success, data }. Reduce any of those shapes to the array
// itself so callers can .map without tripping over a nested object.
export const unwrapList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (payload?.data !== undefined) return unwrapList(payload.data);
  return [];
};

// A { uri, name, type } triple only becomes a real multipart file part on
// native. React Native Web's FormData stringifies anything that is not a Blob,
// so on web the endpoint receives `file` as a plain string and the backend
// cannot read it (it answers 400 "Failed to read uploaded file"). The same
// happens for blob:/data: URIs anywhere, and if the picked asset has no uri.
const NATIVE_FILE_PART =
  Platform.OS !== "web" && !/^(blob:|data:)/;

async function uriToBase64(uri) {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Upload one driver document (KYC) in a way that works on native and on web.
 *
 * Native sends multipart; everything else sends the base64 field the endpoint
 * already accepts. Content-Type is deliberately not set by hand: FormData needs
 * the runtime to append the multipart boundary, and overriding the header drops
 * it, which the server cannot parse at all.
 *
 * @returns the parsed document object.
 */
export async function postDriverDocument({
  documentType,
  docKey,
  uri,
  base64,
  fileName,
  mimeType = "image/jpeg",
}) {
  const name = fileName || (uri || "").split("/").pop() || "upload.jpg";

  if (NATIVE_FILE_PART && uri) {
    const formData = new FormData();
    formData.append("document_type", documentType);
    if (docKey) formData.append("doc_key", docKey);
    formData.append("file", { uri, name, type: mimeType });
    const response = await api.post(AUTH.driverDocuments, formData);
    return response.data?.data || response.data;
  }

  let encoded = base64;
  if (!encoded && uri) encoded = await uriToBase64(uri);
  if (!encoded) {
    throw new Error("Could not read the selected image");
  }

  const response = await api.post(AUTH.driverDocuments, {
    document_type: documentType,
    doc_key: docKey || "",
    file_base64: encoded,
    file_name: name,
  });
  return response.data?.data || response.data;
}

export { getWsUrl } from "./wsUrl";
export default api;
