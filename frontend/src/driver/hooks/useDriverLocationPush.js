import { useEffect, useRef, useState } from "react";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";

const DRIVER_LOCATION_PATH = "/api/tracking/driver-location/";
const PUSH_INTERVAL_MS = 5000;

export default function useDriverLocationPush({ enabled = false, tripId = null, onLocation } = {}) {
  const [vehicleId, setVehicleId] = useState(null);
  const onLocationRef = useRef(null);

  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(API_PATHS.driver.vehicle)
      .then((response) => {
        if (cancelled) return;
        const payload = response.data?.data ?? response.data;
        setVehicleId(payload?.id || payload?.vehicle?.id || null);
      })
      .catch(() => {
        if (!cancelled) setVehicleId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !vehicleId || !navigator.geolocation) return undefined;

    let cancelled = false;
    let lastPush = 0;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (cancelled || now - lastPush < PUSH_INTERVAL_MS) return;
        lastPush = now;

        const payload = {
          vehicle_id: vehicleId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: Math.max(0, Math.round((position.coords.speed || 0) * 3.6)),
          heading: position.coords.heading || 0,
        };
        if (tripId) payload.trip_id = tripId;

        api.post(DRIVER_LOCATION_PATH, payload).catch(() => {});

        onLocationRef.current?.({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: payload.speed,
          heading: payload.heading,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, vehicleId, tripId]);

  return { vehicleId };
}
