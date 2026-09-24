import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { getAccentColor } from "../../utils/glow";
import useAccentTick from "../../hooks/useAccentTick";

function isMapValid(map) {
  try {
    return map && typeof map.getStyle === "function" && map.getStyle();
  } catch {
    return false;
  }
}

export default function CityScatter({ map, cities = [] }) {
  const markersRef = useRef([]);
  const accentTick = useAccentTick();

  useEffect(() => {
    markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    markersRef.current = [];

    if (!isMapValid(map) || !cities.length) return;

    const maxCount = Math.max(...cities.map((c) => c.count || 0), 1);
    const accent = getAccentColor();

    cities.forEach((city) => {
      if (!city.avg_lat || !city.avg_lng) return;

      const size = Math.max(8, Math.sqrt((city.count / maxCount) * 900));
      const opacity = 0.4 + (city.count / maxCount) * 0.6;

      const el = document.createElement("div");
      el.style.cssText = `
        width: ${size}px; height: ${size}px;
        background: ${accent.hex}; border: 2px solid ${accent.dark};
        border-radius: 50%; opacity: ${opacity};
        cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(
        `<div style="font-family:Inter,sans-serif;padding:2px 4px">
          <div style="font-weight:700;font-size:12px">${city.city}</div>
          ${city.country ? `<div style="color:${accent.dark};font-size:10px">${city.country}</div>` : ""}
          <div style="font-weight:700;font-size:11px">${(city.count || 0).toLocaleString()} views (${city.percentage}%)</div>
        </div>`
      );

      try {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([city.avg_lng, city.avg_lat])
          .setPopup(popup)
          .addTo(map);
        markersRef.current.push(marker);
      } catch {}
    });

    return () => {
      markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      markersRef.current = [];
    };
  }, [map, cities, accentTick]);

  return null;
}
