import { useEffect, useRef } from "react";

function isMapValid(map) {
  try {
    return map && typeof map.getStyle === "function" && map.getStyle();
  } catch {
    return false;
  }
}

export default function HeatmapLayer({ map, points = [] }) {
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
            "heatmap-color": [
              "interpolate", ["linear"], ["heatmap-density"],
              0, "rgba(134, 204, 202, 0)",
              0.2, "rgba(134, 204, 202, 0.6)",
              0.4, "rgba(123, 224, 173, 0.7)",
              0.6, "rgba(255, 206, 92, 0.8)",
              0.8, "rgba(255, 113, 206, 0.9)",
              1, "rgba(255, 93, 93, 1)",
            ],
          },
        });
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
    };
  }, [map, points]);

  return null;
}
