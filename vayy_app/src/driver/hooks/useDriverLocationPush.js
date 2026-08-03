import { useEffect, useRef, useCallback } from "react";
import api from "../../shared/lib/api";
import locationService from "../../shared/lib/locationService";
import { TRACKING } from "../../constants";

export default function useDriverLocationPush({ enabled, vehicleId, tripId, onLocation }) {
  const vehicleIdRef = useRef(vehicleId);
  const tripIdRef = useRef(tripId);
  const onLocationRef = useRef(onLocation);
  const enabledRef = useRef(enabled);

  vehicleIdRef.current = vehicleId;
  tripIdRef.current = tripId;
  onLocationRef.current = onLocation;
  enabledRef.current = enabled;

  const handleLocation = useCallback((coords) => {
    if (!vehicleIdRef.current) return;

    const payload = {
      vehicle_id: vehicleIdRef.current,
      lat: coords.latitude,
      lng: coords.longitude,
      speed: coords.speed || 0,
      heading: coords.heading || 0,
    };
    if (tripIdRef.current) {
      payload.trip_id = tripIdRef.current;
    }

    api.post(TRACKING.driverLocation, payload).catch(() => {});

    if (onLocationRef.current) {
      onLocationRef.current({
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed || 0,
        heading: coords.heading || 0,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !vehicleId) return;

    let stopped = false;
    let sub = null;

    (async () => {
      const hasPermission = await locationService.requestPermissions();
      if (!hasPermission || stopped) return;

      sub = await locationService.startTracking(handleLocation, {
        timeInterval: 3000,
        distanceInterval: 5,
      });
    })();

    return () => {
      stopped = true;
      if (sub) {
        locationService.stopTracking();
      }
    };
  }, [enabled, vehicleId, handleLocation]);
}