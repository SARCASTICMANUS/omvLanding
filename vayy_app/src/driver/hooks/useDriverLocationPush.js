import { useEffect, useRef, useCallback } from "react";
import locationService from "../../shared/lib/locationService";
import useWebSocket from "../../shared/hooks/useWebSocket";
import { WS } from "../../constants";

export default function useDriverLocationPush({ enabled, vehicleId, tripId, onLocation }) {
  const vehicleIdRef = useRef(vehicleId);
  const tripIdRef = useRef(tripId);
  const onLocationRef = useRef(onLocation);
  const pendingRef = useRef(null);
  const wasConnectedRef = useRef(false);

  vehicleIdRef.current = vehicleId;
  tripIdRef.current = tripId;
  onLocationRef.current = onLocation;

  const wsPath = enabled && vehicleId ? WS.trackingVehicle(vehicleId) : null;

  const { send, isConnected } = useWebSocket(wsPath, { enabled: !!wsPath });

  // Flush the latest buffered ping as soon as the socket reconnects.
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current && pendingRef.current) {
      send("location_update", pendingRef.current);
      pendingRef.current = null;
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected, send]);

  const handleLocation = useCallback(
    (coords) => {
      if (!vehicleIdRef.current) return;

      const payload = {
        trip_id: tripIdRef.current || undefined,
        lat: coords.latitude,
        lng: coords.longitude,
        speed: coords.speed || 0,
        heading: coords.heading || 0,
      };

      // Stream over the persistent vehicle tracking WebSocket. If the socket
      // is momentarily down, buffer the latest ping and flush it on reconnect.
      if (isConnected) {
        send("location_update", payload);
      } else {
        pendingRef.current = payload;
      }

      if (onLocationRef.current) {
        onLocationRef.current({
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: coords.speed || 0,
          heading: coords.heading || 0,
        });
      }
    },
    [isConnected, send],
  );

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