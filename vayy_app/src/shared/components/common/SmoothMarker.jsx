import React, { useEffect, useRef, useState } from "react";
import { Marker } from "../../components/VayyMap";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function SmoothMarker({ targetLat, targetLng, duration = 1200, children, id, ...markerProps }) {
  const [pos, setPos] = useState({ lat: targetLat, lng: targetLng });
  const animRef = useRef(null);
  const currentRef = useRef({ lat: targetLat, lng: targetLng });

  useEffect(() => {
    if (targetLat == null || targetLng == null) return;

    const startLat = currentRef.current.lat;
    const startLng = currentRef.current.lng;

    if (startLat === targetLat && startLng === targetLng) return;

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);

      const ease = t * (2 - t);

      const lat = lerp(startLat, targetLat, ease);
      const lng = lerp(startLng, targetLng, ease);
      currentRef.current = { lat, lng };
      setPos({ lat, lng });

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetLat, targetLng, duration]);

  if (pos.lat == null || pos.lng == null) return null;

  return (
    <Marker id={id} lngLat={[pos.lng, pos.lat]} {...markerProps}>
      {children}
    </Marker>
  );
}