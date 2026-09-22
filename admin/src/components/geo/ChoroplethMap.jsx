import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { BLUE_PALETTE } from "../../colors";

function isMapValid(map) {
  try {
    return map && typeof map.getStyle === "function" && map.getStyle();
  } catch {
    return false;
  }
}

function lerpColor(a, b, t) {
  const ah = parseInt(a.replace("#", ""), 16);
  const bh = parseInt(b.replace("#", ""), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

function getColor(value, max) {
  const t = Math.min(value / max, 1);
  if (t < 0.25) return lerpColor(BLUE_PALETTE[7], BLUE_PALETTE[5], t / 0.25);
  if (t < 0.5) return lerpColor(BLUE_PALETTE[5], BLUE_PALETTE[3], (t - 0.25) / 0.25);
  if (t < 0.75) return lerpColor(BLUE_PALETTE[3], BLUE_PALETTE[1], (t - 0.5) / 0.25);
  return BLUE_PALETTE[0];
}

export default function ChoroplethMap({ map, countryData = [] }) {
  const addedRef = useRef(false);

  useEffect(() => {
    if (!isMapValid(map) || !countryData.length) return;

    const countByCode = {};
    countryData.forEach((c) => { countByCode[c.country_code] = c.count; });
    const maxCount = Math.max(...countryData.map((c) => c.count), 1);

    const addLayer = async () => {
      try {
        const resp = await fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson");
        const geojson = await resp.json();

        if (!isMapValid(map)) return;

        geojson.features.forEach((f) => {
          const code = f.properties.ISO_A2 || f.properties.iso_a2 || "";
          f.properties.count = countByCode[code] || 0;
          f.properties.color = getColor(f.properties.count, maxCount);
        });

        if (map.getLayer("countries-fill")) map.removeLayer("countries-fill");
        if (map.getLayer("countries-border")) map.removeLayer("countries-border");
        if (map.getSource("countries")) map.removeSource("countries");

        map.addSource("countries", { type: "geojson", data: geojson });
        map.addLayer({
          id: "countries-fill", type: "fill", source: "countries",
          paint: { "fill-color": ["get", "color"], "fill-opacity": 0.5 },
        });
        map.addLayer({
          id: "countries-border", type: "line", source: "countries",
          paint: { "line-color": "#14241C", "line-opacity": 0.15, "line-width": 0.5 },
        });

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });

        map.on("mouseenter", "countries-fill", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const props = e.features?.[0]?.properties;
          if (props) {
            popup.setHTML(`<div style="font-family:Inter,sans-serif;padding:2px 4px">
              <div style="font-weight:700;font-size:12px">${props.NAME || props.name || ""}</div>
              <div style="font-weight:700;font-size:11px">${(props.count || 0).toLocaleString()} events</div>
            </div>`).setLngLat(e.lngLat).addTo(map);
          }
        });

        map.on("mouseleave", "countries-fill", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });

        addedRef.current = true;
      } catch (err) {
        console.error("Failed to load countries GeoJSON:", err);
      }
    };

    if (map.loaded()) {
      addLayer();
    } else {
      map.on("load", addLayer);
    }

    return () => {
      try {
        if (isMapValid(map)) {
          if (map.getLayer("countries-fill")) map.removeLayer("countries-fill");
          if (map.getLayer("countries-border")) map.removeLayer("countries-border");
          if (map.getSource("countries")) map.removeSource("countries");
        }
      } catch {}
      addedRef.current = false;
    };
  }, [map, countryData]);

  return null;
}
