const COLOR_KEY = "admin_glow_color";
const ANIM_KEY = "admin_glow_anim";
const ACCENT_KEY = "admin_accent_color";
const SPEED_KEY = "admin_glow_speed";

export const ACCENT_CHANGE_EVENT = "vayy-accent-change";

export const GLOW_COLORS = [
  { id: "red", label: "Red", rgb: "240, 52, 60", swatch: "#F0343C" },
  { id: "orange", label: "Orange", rgb: "255, 122, 48", swatch: "#FF7A30" },
  { id: "amber", label: "Amber", rgb: "251, 191, 36", swatch: "#FBBF24" },
  { id: "green", label: "Green", rgb: "34, 197, 94", swatch: "#22C55E" },
  { id: "cyan", label: "Cyan", rgb: "34, 211, 238", swatch: "#22D3EE" },
  { id: "blue", label: "Blue", rgb: "56, 130, 246", swatch: "#3882F6" },
  { id: "purple", label: "Purple", rgb: "167, 139, 250", swatch: "#A78BFA" },
  { id: "pink", label: "Pink", rgb: "244, 114, 182", swatch: "#F472B6" },
  { id: "white", label: "White", rgb: "255, 255, 255", swatch: "#FFFFFF" },
];

export const GLOW_ANIMS = [
  { id: "spin", label: "Spin" },
  { id: "pulse", label: "Pulse" },
  { id: "wave", label: "Wave" },
  { id: "breathe", label: "Breathe" },
  { id: "bloom", label: "Bloom" },
  { id: "swing", label: "Swing" },
  { id: "hue", label: "Hue" },
  { id: "flicker", label: "Flicker" },
  { id: "still", label: "Still" },
];

export const ACCENT_COLORS = [
  { id: "blue", label: "Blue", hex: "#2E5CFF", light: "#5B8AFF", dark: "#1A3FCC", rgb: "46 92 255" },
  { id: "indigo", label: "Indigo", hex: "#4F46E5", light: "#818CF8", dark: "#3730A3", rgb: "79 70 229" },
  { id: "violet", label: "Violet", hex: "#7C3AED", light: "#A78BFA", dark: "#5B21B6", rgb: "124 58 237" },
  { id: "teal", label: "Teal", hex: "#0D9488", light: "#2DD4BF", dark: "#115E59", rgb: "13 148 136" },
  { id: "green", label: "Green", hex: "#16A34A", light: "#4ADE80", dark: "#166534", rgb: "22 163 74" },
  { id: "orange", label: "Orange", hex: "#EA580C", light: "#FB923C", dark: "#9A3412", rgb: "234 88 12" },
  { id: "rose", label: "Rose", hex: "#E11D48", light: "#FB7185", dark: "#9F1239", rgb: "225 29 72" },
  { id: "slate", label: "Slate", hex: "#334155", light: "#64748B", dark: "#1E293B", rgb: "51 65 85" },
  { id: "white", label: "White", hex: "#FFFFFF", light: "#FFFFFF", dark: "#E2E8F0", rgb: "255 255 255" },
];

function read(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getGlowColor() {
  const id = read(COLOR_KEY, "red");
  return GLOW_COLORS.find((c) => c.id === id) || GLOW_COLORS[0];
}

export function getGlowAnim() {
  const id = read(ANIM_KEY, "spin");
  return GLOW_ANIMS.find((a) => a.id === id) || GLOW_ANIMS[0];
}

export function getAccentColor() {
  const id = read(ACCENT_KEY, "blue");
  return ACCENT_COLORS.find((c) => c.id === id) || ACCENT_COLORS[0];
}

export function getGlowSpeed() {
  const v = parseFloat(read(SPEED_KEY, "8"));
  return Number.isFinite(v) && v >= 1 && v <= 30 ? v : 8;
}

export function setGlowSpeed(sec) {
  const v = Math.min(30, Math.max(1, Number(sec) || 8));
  const root = document.documentElement;
  root.style.setProperty("--glow-dur", `${v}s`);
  write(SPEED_KEY, String(v));
  return v;
}

function emitAccentChange(color) {
  try {
    window.dispatchEvent(new CustomEvent(ACCENT_CHANGE_EVENT, { detail: color }));
  } catch {
    /* ignore */
  }
}

export function applyGlow(colorId, animId) {
  const color = GLOW_COLORS.find((c) => c.id === colorId) || getGlowColor();
  const anim = GLOW_ANIMS.find((a) => a.id === animId) || getGlowAnim();
  const root = document.documentElement;
  root.style.setProperty("--glow-rgb", color.rgb);
  root.setAttribute("data-glow-anim", anim.id);
  write(COLOR_KEY, color.id);
  write(ANIM_KEY, anim.id);
  return { color, anim };
}

function selectArrowSvg(hex) {
  const c = hex.replace("#", "%23");
  return `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='${c}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
}

export function applyAccent(colorId) {
  const color = ACCENT_COLORS.find((c) => c.id === colorId) || getAccentColor();
  const root = document.documentElement;
  root.style.setProperty("--accent-blue", color.hex);
  root.style.setProperty("--accent-blue-light", color.light);
  root.style.setProperty("--accent-blue-dark", color.dark);
  root.style.setProperty("--accent-blue-rgb", color.rgb);
  root.style.setProperty("--select-arrow", selectArrowSvg(color.hex));
  root.setAttribute("data-accent", color.id);
  write(ACCENT_KEY, color.id);
  emitAccentChange(color);
  return color;
}

export function initGlow() {
  setGlowSpeed(getGlowSpeed());
  applyAccent(getAccentColor().id);
  return applyGlow(getGlowColor().id, getGlowAnim().id);
}
