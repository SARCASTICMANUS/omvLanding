import * as Location from "expo-location";
import { Alert, Linking, Platform } from "react-native";

class LocationService {
  constructor() {
    this.subscriptions = new Map();
    this.nextSubscriptionId = 1;
    this.currentLocation = null;
    this.foregroundGranted = false;
    this.backgroundRequested = false;
  }

  /**
   * Validates browser security context on Web.
   */
  _isSecureWebContext() {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      return window.isSecureContext || isLocalhost;
    }
    return true;
  }

  async requestPermissions(options = {}) {
    const { force = false } = options;
    try {
      // 1. Check for HTTPS on Web
      if (!this._isSecureWebContext()) {
        const errorMsg =
          "Geolocation requires an HTTPS connection or localhost. Browsers block location requests on HTTP IP addresses.";
        console.error(`[LocationService] ${errorMsg}`);
        this._handlePermissionDenied(errorMsg);
        return false;
      }

      // 2. Foreground permission - read current status first so a granted
      //    permission is never re-prompted on every startTracking() call.
      let foregroundStatus = "undetermined";
      if (!force && this.foregroundGranted) return true;
      if (!force) {
        try {
          const current = await Location.getForegroundPermissionsAsync();
          foregroundStatus = current?.status || "undetermined";
        } catch {
          foregroundStatus = "undetermined";
        }
      }
      if (foregroundStatus !== "granted") {
        const { status: requestedStatus } =
          await Location.requestForegroundPermissionsAsync();
        foregroundStatus = requestedStatus;
      }

      if (foregroundStatus !== "granted") {
        this._handlePermissionDenied(
          "Foreground location access is required to track your trip."
        );
        return false;
      }
      this.foregroundGranted = true;

      // 3. Background permission (Mobile Only) - asked at most once per app
      //    session, and skipped entirely if already granted.
      if (Platform.OS !== "web" && (force || !this.backgroundRequested)) {
        this.backgroundRequested = true;
        try {
          const currentBg = await Location.getBackgroundPermissionsAsync();
          if (currentBg?.status !== "granted") {
            const { status: backgroundStatus } =
              await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus !== "granted") {
              console.warn(
                "[LocationService] Background location denied. App will not track when minimized."
              );
            }
          }
        } catch (bgErr) {
          console.warn(
            "[LocationService] Background permission not available:",
            bgErr.message
          );
        }
      }

      return true;
    } catch (err) {
      console.error("[LocationService] Permission request failed:", err);
      return false;
    }
  }

  _registerSubscription(removeFn) {
    const id = this.nextSubscriptionId++;
    this.subscriptions.set(id, removeFn);
    return { id, remove: () => this.stopTracking(id) };
  }

  async startTracking(callback, options = {}) {
    const hasPermission = await this.requestPermissions({
      force: options.forcePermissionRequest === true,
    });
    if (!hasPermission) return null;

    // Direct Browser HTML5 Geolocation API for Web
    if (Platform.OS === "web" && typeof navigator !== "undefined" && "geolocation" in navigator) {
      return this._startWebWatch(callback, options);
    }

    // Mobile fallback via Expo Location API
    try {
      const nativeSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: options.distanceInterval || 5,
          timeInterval: options.timeInterval || 3000,
          ...options,
        },
        (location) => {
          if (location?.coords) {
            this.currentLocation = location.coords;
            callback(location.coords);
          }
        }
      );
      return this._registerSubscription(() => {
        if (typeof nativeSubscription.remove === "function") {
          nativeSubscription.remove();
        }
      });
    } catch (err) {
      console.error("[LocationService] watchPositionAsync failed:", err);
      return null;
    }
  }

  /**
   * Web location watching, with recovery.
   *
   * `navigator.geolocation.watchPosition` fails with POSITION_UNAVAILABLE (code
   * 2) — "Position update is unavailable" — on macOS quite routinely: CoreLocation
   * has no fix yet, there is no Wi-Fi/cell triangulation, or the browser has not
   * finished initialising. It is transient in that case, but a bare watch dies
   * permanently on the first error and never recovers, leaving the driver with no
   * position for the rest of the journey.
   *
   * So: retry with backoff, and on the first failure also retry once with
   * enableHighAccuracy off. GPS-grade accuracy is not required to place a vehicle
   * on a map, and asking for it is what tips macOS into POSITION_UNAVAILABLE.
   * PERMISSION_DENIED is not retried — the user has to decide that.
   */
  _startWebWatch(callback, options = {}) {
    const MAX_RETRIES = 6;
    const BASE_DELAY_MS = 1500;
    // Escalating backoff: 1.5s, 3s, 6s, 12s, 24s, 24s.
    const delayFor = (attempt) => BASE_DELAY_MS * 2 ** attempt;

    let watchId = null;
    let attempt = 0;
    // High accuracy first; dropped to false after the first transient failure.
    let highAccuracy = options.enableHighAccuracy ?? true;
    let retryTimer = null;
    let stopped = false;

    const clearWatch = () => {
      if (watchId != null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          // Already gone; nothing to do.
        }
        watchId = null;
      }
    };

    const start = () => {
      if (stopped) return;

      try {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (stopped) return;
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
            };
            this.currentLocation = coords;
            // A successful fix means the source is live again, so reset the
            // backoff: a later outage should not inherit a 24s wait.
            attempt = 0;
            callback(coords);
          },
          (error) => {
            if (stopped) return;

            // code 1 is PERMISSION_DENIED — retrying cannot help.
            if (error?.code === 1) {
              console.error(
                "[LocationService] Web Geolocation permission denied:",
                error.message
              );
              // Not retryable — the user has to change the browser setting — so
              // drop the watch instead of leaving a dead registration open that
              // will only ever fire this error again.
              clearWatch();
              this._handlePermissionDenied(
                "Location permission was denied. Allow it in your browser to share your position."
              );
              return;
            }

            if (attempt === 0) {
              // First failure: drop the high-accuracy demand and let the watch
              // re-register. This alone resolves the macOS case most of the time.
              highAccuracy = false;
            }

            attempt += 1;
            if (attempt > MAX_RETRIES) {
              console.error(
                `[LocationService] Web Geolocation unavailable after ${MAX_RETRIES} retries:`,
                error.message
              );
              clearWatch();
              return;
            }

            const delay = delayFor(attempt - 1);
            console.warn(
              `[LocationService] Web Geolocation unavailable (${error?.code}: ${error?.message}); retrying in ${delay}ms (${attempt}/${MAX_RETRIES})`
            );

            clearWatch();
            retryTimer = setTimeout(start, delay);
          },
          {
            enableHighAccuracy: highAccuracy,
            // A short timeout so a silent provider surfaces as an error we can
            // retry, rather than a watch that hangs forever with no callback.
            timeout: options.timeout ?? 10000,
            maximumAge: options.maximumAge ?? 3000,
          }
        );
      } catch (webErr) {
        console.error("[LocationService] Web watchPosition threw:", webErr);
      }
    };

    start();

    return this._registerSubscription(() => {
      stopped = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      clearWatch();
    });
  }

  stopTracking(handle) {
    if (handle == null) {
      for (const removeFn of this.subscriptions.values()) {
        try {
          removeFn();
        } catch (err) {
          console.error("[LocationService] Failed to stop watcher:", err);
        }
      }
      this.subscriptions.clear();
      return;
    }

    const id = typeof handle === "object" ? handle.id : handle;
    const removeFn = this.subscriptions.get(id);
    if (!removeFn) return;
    try {
      removeFn();
    } catch (err) {
      console.error("[LocationService] Failed to stop watcher:", err);
    }
    this.subscriptions.delete(id);
  }

  async getCurrentLocation() {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && "geolocation" in navigator) {
      if (!this._isSecureWebContext()) {
        console.error("[LocationService] Cannot get location on insecure HTTP connection.");
        return null;
      }

      return new Promise((resolve) => {
        // Same transient POSITION_UNAVAILABLE as the watcher, and the same
        // remedy: one retry without enableHighAccuracy, which is what tips
        // macOS over. Without it a single hiccup makes a one-shot read fail
        // permanently, which is what breaks "use my location".
        let usedFallback = false;
        const attempt = (highAccuracy) => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                altitude: position.coords.altitude,
                accuracy: position.coords.accuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              };
              this.currentLocation = coords;
              resolve(coords);
            },
            (error) => {
              if (error?.code === 2 && !usedFallback) {
                usedFallback = true;
                attempt(false);
                return;
              }
              console.error("[LocationService] Web getCurrentPosition error:", error.message);
              resolve(null);
            },
            { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 10000 }
          );
        };
        attempt(true);
      });
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return location.coords;
    } catch (error) {
      console.error("[LocationService] Error getting current location:", error);
      return null;
    }
  }

  _handlePermissionDenied(message) {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        window.alert(`Location Access Notice: ${message}`);
      }
    } else {
      Alert.alert("Permission Denied", message, [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => Linking.openSettings() },
      ]);
    }
  }
}

export default new LocationService();