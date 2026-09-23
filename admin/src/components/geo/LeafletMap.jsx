import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const MAP_STYLE = import.meta.env.VITE_MAP_STYLE_URL || "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";

const MapLibreMap = forwardRef(function MapLibreMap(
  { center = [80.9462, 26.8467], zoom = 4, height = "400px", className = "", children, onMapLoad },
  ref
) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center,
      zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      onMapLoad?.(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className={`glass-card overflow-hidden ${className}`}>
      <div ref={containerRef} style={{ height, width: "100%" }} />
      {children}
    </div>
  );
});

export default MapLibreMap;
