/**
 * VAYY | 3D Map Helpers
 * Reusable functions for 3D vehicle tracking using Three.js & MapLibre
 */

import maplibregl from "maplibre-gl";

/**
 * Linearly interpolates between two values
 */
export const lerp = (start, end, t) => {
  return start + (end - start) * t;
};

/**
 * Linearly interpolates between two coordinates [lng, lat]
 */
export const lerpCoords = (start, end, t) => {
  return [
    lerp(start[0], end[0], t),
    lerp(start[1], end[1], t)
  ];
};

/**
 * Calculates bearing between two [lng, lat] points
 */
export const getBearing = (start, end) => {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;
  
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.cos(((lon2 - lon1) * Math.PI) / 180);
  
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * Converts LngLat to Three.js World Coordinates for MapLibre Custom Layer
 * @param {Array} lngLat [lng, lat]
 * @param {Number} altitude 
 * @returns {Object} { x, y, z }
 */
export const lngLatToWorld = (lngLat, altitude = 0) => {
  const mercator = maplibregl.MercatorCoordinate.fromLngLat(lngLat, altitude);
  return {
    x: mercator.x,
    y: mercator.y,
    z: mercator.z
  };
};
