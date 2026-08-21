import React, { useEffect, useRef, useState } from "react";
import { Marker } from "../../components/VayyMap";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const M_PER_DEG_LAT = 111320;

/**
 * SmoothMarker — universally smooth vehicle marker.
 *
 * - Interpolates toward the latest WS position (ease-out) while updates are
 *   fresh (<= staleAfterMs).
 * - Falls back to dead reckoning when updates stall: extrapolates along the
 *   last known heading at the last known speed, capped at maxDeadReckonMs so
 *   a parked/disconnected vehicle never drifts away.
 */
export default function SmoothMarker({
  targetLat,
  targetLng,
  duration = 1200,
  heading,
  speedKmh,
  staleAfterMs = 4000,
  maxDeadReckonMs = 10000,
  children,
  id,
  ...markerProps
}) {
  const [pos, setPos] = useState({ lat: targetLat, lng: targetLng });
  const currentRef = useRef({ lat: targetLat, lng: targetLng });
  const targetRef = useRef({ lat: targetLat, lng: targetLng });
  const interpStartRef = useRef({ lat: targetLat, lng: targetLng, time: Date.now() });
  const lastUpdateRef = useRef(Date.now());
  const deadStartRef = useRef(null);
  const lastSetRef = useRef({ lat: null, lng: null });

  useEffect(() => {
    if (targetLat == null || targetLng == null) return;
    targetRef.current = { lat: targetLat, lng: targetLng };
    lastUpdateRef.current = Date.now();
    deadStartRef.current = null;
    interpStartRef.current = { ...currentRef.current, time: Date.now() };
  }, [targetLat, targetLng]);

  useEffect(() => {
    let raf;
    let lastFrame = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = Math.min((now - lastFrame) / 1000, 1);
      lastFrame = now;

      const tgt = targetRef.current;
      const sinceUpdate = now - lastUpdateRef.current;

      if (sinceUpdate <= staleAfterMs && tgt.lat != null && tgt.lng != null) {
        // Interpolate toward the target with ease-out.
        deadStartRef.current = null;
        const t = Math.min((now - interpStartRef.current.time) / duration, 1);
        const ease = t * (2 - t);
        const start = interpStartRef.current;
        currentRef.current = {
          lat: lerp(start.lat, tgt.lat, ease),
          lng: lerp(start.lng, tgt.lng, ease),
        };
      } else if (speedKmh > 0 && heading != null) {
        // Dead reckoning: extrapolate along last heading * speed.
        if (deadStartRef.current == null) deadStartRef.current = now;
        if (now - deadStartRef.current <= maxDeadReckonMs) {
          const stepM = (speedKmh / 3.6) * dt;
          const lat = currentRef.current.lat;
          const latDelta = (stepM * Math.cos((heading * Math.PI) / 180)) / M_PER_DEG_LAT;
          const lngDelta =
            (stepM * Math.sin((heading * Math.PI) / 180)) /
            (M_PER_DEG_LAT * (Math.cos((lat * Math.PI) / 180) || 1));
          currentRef.current = {
            lat: lat + latDelta,
            lng: currentRef.current.lng + lngDelta,
          };
        }
      } else {
        deadStartRef.current = null;
      }

      const p = currentRef.current;
      if (lastSetRef.current.lat !== p.lat || lastSetRef.current.lng !== p.lng) {
        lastSetRef.current = p;
        setPos(p);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, staleAfterMs, maxDeadReckonMs, speedKmh, heading]);

  if (pos.lat == null || pos.lng == null) return null;

  return (
    <Marker id={id} lngLat={[pos.lng, pos.lat]} {...markerProps}>
      {children}
    </Marker>
  );
}