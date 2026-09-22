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
              0, "rgba(100, 170, 213, 0)",
              0.2, "rgba(94, 154, 205, 0.45)",
              0.4, "rgba(76, 120, 197, 0.62)",
              0.5, "rgba(62, 102, 182, 0.72)",
              0.7, "rgba(46, 77, 165, 0.84)",
              0.8, "rgba(30, 58, 138, 0.9)",
              1, "rgba(20, 38, 100, 0.96)",
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
