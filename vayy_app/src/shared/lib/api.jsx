import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { STORAGE_KEYS, AUTH, API_TIMEOUT, API_URL } from "../../constants";

export { API_URL };

// Use the config-resolved base URL directly
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

// ---------------------------------------------------------------------------
// In-memory access-token cache.
//
// MEASURED (T4, cold start on emulator-5554, 4 requests):
//   the two AsyncStorage.getItem() calls below cost p50 130 ms / p95 1006 ms and
//   are awaited SERIALLY inside the request interceptor, so every single HTTP
//   call pays that before the request even leaves the device (1349 ms total for
//   4 requests on one cold start). Caching the token in memory removes it from
//   the hot path.
//
// Correctness: the cache holds ONLY the access token. It is never used for the
// verification stage (G7 - that is always re-read from the server) and never for
// the refresh token. It is invalidated on login, on verify-otp, on refresh and
// on logout/wipe. A MISS is deliberately NOT cached: while signed out there is
// no token, and caching that absence would keep stripping the Authorization
// header from the request that follows a fresh login.
// ---------------------------------------------------------------------------
let _accessTokenCache = null;

export const setAccessTokenCache = (token) => {
  _accessTokenCache = token ? String(token) : null;
};

export const clearAccessTokenCache = () => {
  _accessTokenCache = null;
};

const readToken = async () => {
  if (_accessTokenCache) return _accessTokenCache;

  const token = await AsyncStorage.getItem(STORAGE_KEYS.token);
  const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.accessToken);
  const resolved = token || accessToken || null;

  // Only a real token is cached; see the note above.
  if (resolved) _accessTokenCache = resolved;
  return resolved;
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

  // The interceptor reads the access token from memory; keep it in step with the
  // token we just rotated, otherwise every later request would send the spent one.
  setAccessTokenCache(nextAccess);

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

    // GUARDRAIL G3: first captured API call must equal per-target base
    // 10.0.2.2:8000 / localhost post adb-reverse; anything else = abort.

    // G4: verification gate — 403 verification_required from gated endpoints.
    if (error.response?.status === 403 && originalRequest) {
      const data = error.response?.data;
      if (data && data.code === "verification_required") {
        // Show verification gate modal with server state block copy verbatim.
        // The gate will revalidate on boot, AppState foreground, nav focus, 403, WS 4403.
        // No client caching (G7). Popup copy verbatim from server state block.
        // For now, re-throw with a structured error the app can catch.
        return Promise.reject({
          message: data.code,
          verificationState: data.data,
          originalError: error,
        });
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

export { getWsUrl } from "./wsUrl";
export default api;
