export const env = {
  apiUrl: import.meta.env.VITE_API_URL || "https://onmyvayy.com",
  appName: import.meta.env.VITE_APP_NAME || "OMV",
  cityCode: import.meta.env.VITE_CITY_CODE || "default",
  socketReconnectAttempts: Number(import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || 8),
  socketReconnectBaseDelay: Number(import.meta.env.VITE_SOCKET_RECONNECT_BASE_DELAY || 800),
};

