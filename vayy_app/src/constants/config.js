import { Platform } from "react-native";

export const API_TIMEOUT = 10000;
export const DEFAULT_API_URL = "http://localhost:8000";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, "");

// Android emulators reach the development host through 10.0.2.2.
// "localhost" inside the emulator points back to the emulator, not Windows/Docker.
export const API_URL =
  Platform.OS === "android"
    ? normalizedApiUrl.replace(
        /^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/i,
        (_, protocol) => `${protocol}10.0.2.2`
      )
    : normalizedApiUrl;

export const WS_MAX_RECONNECT = 5;

// Backoff schedule for reconnect attempts: 1s, 2s, 4s, 8s, 16s, capped at 30s,
// with +/-25% jitter so a fleet of clients does not stampede the gateway.
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;
export const WS_RECONNECT_JITTER = 0.25;

// Outbound frames produced while the socket is not OPEN are buffered per
// channel and flushed on the next successful open. A location update is only
// useful for a few seconds, so anything older than this is dropped on flush
// rather than delivered late.
export const WS_OUTBOX_MAX = 50;
export const WS_OUTBOX_TTL_MS = 120000;

// A channel with no subscribers is torn down, but not while the app is in the
// foreground: a driver idling on the radar screen with the socket closed would
// silently miss dispatch pushes. 60s was short enough to reap live sockets.
export const WS_IDLE_TTL_MS = 300000;
