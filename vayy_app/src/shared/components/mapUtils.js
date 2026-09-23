import { DEFAULT_CENTER } from "../../constants/mapConfig";

export { DEFAULT_CENTER };

export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_API_KEY || "VHJ2bQbYo88r3CZHiOKU";
export const MAPTILER_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

export function hexToGray(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 4) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? h.slice(6, 8) : "";
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `#${[y, y, y].map((v) => v.toString(16).padStart(2, "0")).join("")}${a}`;
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const NAMED_COLORS = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  grey: [128, 128, 128],
  gray: [128, 128, 128],
  silver: [192, 192, 192],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  purple: [128, 0, 128],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
  cyan: [0, 255, 255],
  transparent: [0, 0, 0],
};

function grayCss(r, g, b, a) {
  const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  if (a == null) return `rgb(${y},${y},${y})`;
  return `rgba(${y},${y},${y},${a})`;
}

export function toGrayColor(value) {
  if (typeof value !== "string") return value;
  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) return hexToGray(value) || value;
  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const p = rgbMatch[1].split(",").map((x) => parseFloat(x.trim()));
    return grayCss(p[0] || 0, p[1] || 0, p[2] || 0, p.length >= 4 ? p[3] : undefined);
  }
  const hslMatch = value.match(/^hsla?\(([^)]+)\)$/i);
  if (hslMatch) {
    const p = hslMatch[1].split(",").map((x) => parseFloat(x.trim()));
    const [r, g, b] = hslToRgb(p[0] || 0, (p[1] || 0) / 100, (p[2] || 0) / 100);
    return grayCss(r, g, b, p.length >= 4 ? p[3] : undefined);
  }
  const named = NAMED_COLORS[value.toLowerCase()];
  if (named) return grayCss(named[0], named[1], named[2], undefined);
  return value;
}

export function grayscaleWalk(value) {
  if (typeof value === "string") return toGrayColor(value);
  if (Array.isArray(value)) return value.map(grayscaleWalk);
  if (value && typeof value === "object") {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = grayscaleWalk(value[k]); });
    return out;
  }
  return value;
}

export const ROAD_LAYERS = new Set([
  "Tunnel",
  "Tunnel outline",
  "Minor road outline",
  "Major road outline",
  "Highway outline",
  "Road under construction",
  "Minor road",
  "Major road",
  "Highway",
  "Pier road",
  "Bridge outline",
  "Bridge",
  "Footway tunnel outline",
  "Footway tunnel",
  "Road labels",
  "Highway junction",
  "Highway shield",
  "Highway shield (US)",
  "Highway shield interstate top (US)",
  "Highway shield interstate (US)",
  "Oneway",
]);

export function transformStyleToGrayscale(style) {
  if (!style || typeof style !== "object") return style;
  const layers = style.layers;
  if (!Array.isArray(layers)) return grayscaleWalk(style);
  layers.forEach((layer) => {
    if (!layer || !layer.paint) return;
    if (ROAD_LAYERS.has(layer.id)) return;
    layer.paint = grayscaleWalk(layer.paint);
  });
  return style;
}

export function convertInitialRegion(region) {
  if (!region) return undefined;
  const { latitude, longitude, latitudeDelta } = region;
  const zoom = latitudeDelta
    ? Math.round(14 - Math.log2(((latitudeDelta || 0.05) * 111) / 2))
    : 14;
  return {
    center: [longitude || DEFAULT_CENTER.longitude, latitude || DEFAULT_CENTER.latitude],
    zoom,
  };
}