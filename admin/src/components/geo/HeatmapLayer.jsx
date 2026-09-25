import { useEffect, useRef } from "react";
import { getAccentColor } from "../../utils/glow";
import useAccentTick from "../../hooks/useAccentTick";

function isMapValid(map) {
  try {
    return map && typeof map.getStyle === "function" && map.getStyle();
  } catch {
    return false;
  }
}

function heatRamp() {
  const [r, g, b] = getAccentColor().rgb.split(/\s+/).map(Number);
  return [
    "interpolate", ["linear"], ["heatmap-density"],
    0, `rgba(${r}, ${g}, ${b}, 0)`,
    0.2, `rgba(${r}, ${g}, ${b}, 0.35)`,
    0.4, `rgba(${r}, ${g}, ${b}, 0.55)`,
    0.55, `rgba(${r}, ${g}, ${b}, 0.7)`,
    0.7, `rgba(${r}, ${g}, ${b}, 0.84)`,
    0.85, `rgba(${r}, ${g}, ${b}, 0.92)`,
    1, `rgba(${r}, ${g}, ${b}, 0.98)`,
  ];
}

export default function HeatmapLayer({ map, points = [] }) {
  const accentTick = useAccentTick();
  const addedRef = useRef(false);

  useEffect(() => {
    if (!isMapValid(map) || !points.length) return;

    const geojson = {
      type: "FeatureCollection",
      features: points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { weight: p.weight || 1 },
      })),
    };

    const addLayer = () => {
      if (!isMapValid(map)) return;
      try {
        if (map.getLayer("geo-heat-layer")) map.removeLayer("geo-heat-layer");
        if (map.getSource("geo-heat")) map.removeSource("geo-heat");

        map.addSource("geo-heat", { type: "geojson", data: geojson });
        map.addLayer({
          id: "geo-heat-layer",
          type: "heatmap",
          source: "geo-heat",
          paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": 1,
            "heatmap-radius": 20,
            "heatmap-opacity": 0.7,
            "heatmap-color": heatRamp(),
          },
        });
        addedRef.current = true;
      } catch {}
    };

    if (map.loaded()) {
      addLayer();
    } else {
      map.on("load", addLayer);
    }

    return () => {
      try {
        if (isMapValid(map)) {
          if (map.getLayer("geo-heat-layer")) map.removeLayer("geo-heat-layer");
          if (map.getSource("geo-heat")) map.removeSource("geo-heat");
        }
      } catch {}
      addedRef.current = false;
    };
  }, [map, points, accentTick]);

  return null;
}
