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
      try {
        const watchId = navigator.geolocation.watchPosition(
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
            callback(coords);
          },
          (error) => {
            console.error("[LocationService] Web Geolocation watch error:", error.message);
          },
          {
            enableHighAccuracy: options.enableHighAccuracy ?? true,
            timeout: options.timeout ?? 15000,
            maximumAge: options.maximumAge ?? 3000,
          }
        );

        return this._registerSubscription(() =>
          navigator.geolocation.clearWatch(watchId)
        );
      } catch (webErr) {
        console.error("[LocationService] Web watchPosition failed:", webErr);
        return null;
      }
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
            console.error("[LocationService] Web getCurrentPosition error:", error.message);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
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