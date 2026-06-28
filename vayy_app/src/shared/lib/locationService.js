import * as Location from "expo-location";
import { Alert, Linking } from "react-native";

class LocationService {
  constructor() {
    this.subscription = null;
    this.currentLocation = null;
    this.listeners = [];
  }

  async requestPermissions() {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== "granted") {
        this._handlePermissionDenied("Foreground location access is required to track your trip and show your position on the map.");
        return false;
      }

      // Background tracking is essential for Drivers
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.warn("[LocationService] Background location denied. App will not track while minimized.");
      }

      return true;
    } catch (err) {
      console.error("[LocationService] Permission request failed:", err);
      return false;
    }
  }

  async startTracking(callback, options = {}) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    if (this.subscription) {
      this.subscription.remove();
    }

    try {
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: options.distanceInterval || 5, // meters
          timeInterval: options.timeInterval || 3000, // ms
          ...options
        },
        (location) => {
          if (location.coords) {
            this.currentLocation = location.coords;
            callback(location.coords);
          }
        }
      );
      return this.subscription;
    } catch (err) {
      console.error("[LocationService] watchPositionAsync failed:", err);
      return null;
    }
  }

  stopTracking() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }

  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return location.coords;
    } catch (error) {
      console.error("[LocationService] Error getting current location:", error);
      return null;
    }
  }
}

export default new LocationService();
