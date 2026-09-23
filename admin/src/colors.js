// Memphis Design System — Single Source of Truth
// =================================================

// Core palette — CSS variables defined in index.css
export const MEMPHIS_PINK = "#009849";
export const MEMPHIS_YELLOW = "#FFB020";
export const MEMPHIS_TEAL = "#2FA97C";
export const MEMPHIS_PURPLE = "#14532D";
export const MEMPHIS_INK = "#14241C";
export const MEMPHIS_PAPER = "#F1F6F1";
export const MEMPHIS_MINT = "#7BE0AD";
export const MEMPHIS_CORAL = "#FF5D5D";
export const MEMPHIS_LIME = "#A3E635";

// Functional modifiers — controlled opacity for data-heavy contexts
export const MEMPHIS_PINK_5 = "#0098490D";    // pink/5  — table row hover
export const MEMPHIS_PINK_10 = "#0098491A";   // pink/10 — subtle tint
export const MEMPHIS_TEAL_10 = "#2FA97C1A";   // teal/10
export const MEMPHIS_YELLOW_10 = "#FFB0201A"; // yellow/10
export const MEMPHIS_PURPLE_10 = "#14532D1A"; // purple/10
export const MEMPHIS_MINT_10 = "#7BE0AD1A";   // mint/10
export const MEMPHIS_CORAL_10 = "#FF5D5D1A";  // coral/10
export const MEMPHIS_INK_5 = "#14241C0D";     // ink/5 — faint borders
export const MEMPHIS_INK_10 = "#14241C1A";    // ink/10 — table borders
export const MEMPHIS_PURPLE_20 = "#14532D33"; // purple/20 — chart gridlines

// Status semantics — blue-family only
export const STATUS_ACTIVE = "#2E5CFF";  // blue — live/active/running
export const STATUS_PAUSED = "#93C5FD";  // light blue — paused/pending
export const STATUS_ERROR = "#FF5D5D";   // coral — errors/blocked/cancelled
export const STATUS_INACTIVE = "#2E5CFF80"; // blue/50 — inactive/disabled

// Memphis tints (for backgrounds) — kept for backward compat
export const MEMPHIS_PINK_TINT = MEMPHIS_PINK_10;
export const MEMPHIS_TEAL_TINT = MEMPHIS_TEAL_10;
export const MEMPHIS_YELLOW_TINT = MEMPHIS_YELLOW_10;
export const MEMPHIS_PURPLE_TINT = MEMPHIS_PURPLE_10;
export const MEMPHIS_MINT_TINT = MEMPHIS_MINT_10;
export const MEMPHIS_CORAL_TINT = MEMPHIS_CORAL_10;

// Route colors — 14 blue-family color sets for route map display
export const ROUTE_COLORS = [
  { line: "#2E5CFF", bg: "#2E5CFF1A", text: "#1A3FCC", dot: "#2E5CFF" },
  { line: "#1A3FCC", bg: "#1A3FCC1A", text: "#0F2FBF", dot: "#1A3FCC" },
  { line: "#4D7AFF", bg: "#4D7AFF1A", text: "#2E5CFF", dot: "#4D7AFF" },
  { line: "#5B8AFF", bg: "#5B8AFF1A", text: "#2E5CFF", dot: "#5B8AFF" },
  { line: "#7DA2FF", bg: "#7DA2FF1A", text: "#4D7AFF", dot: "#7DA2FF" },
  { line: "#93C5FD", bg: "#93C5FD1A", text: "#5B8AFF", dot: "#93C5FD" },
  { line: "#AFCDFF", bg: "#AFCDFF1A", text: "#5B8AFF", dot: "#AFCDFF" },
  { line: "#7DD3FC", bg: "#7DD3FC1A", text: "#2E5CFF", dot: "#7DD3FC" },
  { line: "#3B6EFF", bg: "#3B6EFF1A", text: "#1A3FCC", dot: "#3B6EFF" },
  { line: "#1E4FD8", bg: "#1E4FD81A", text: "#0F2FBF", dot: "#1E4FD8" },
  { line: "#0F3DA6", bg: "#0F3DA61A", text: "#092B77", dot: "#0F3DA6" },
  { line: "#2E6DFF", bg: "#2E6DFF1A", text: "#1A3FCC", dot: "#2E6DFF" },
  { line: "#6E9BFF", bg: "#6E9BFF1A", text: "#3B6EFF", dot: "#6E9BFF" },
  { line: "#C3D9FF", bg: "#C3D9FF1A", text: "#4D7AFF", dot: "#C3D9FF" },
];

// ── Chart color system ──────────────────────────────────────────────
// Primary brand blue
export const BLUE_PRIMARY = "#2E5CFF";

// BLUE_PALETTE — normal analytical data series. Multiple series graph:
// use only DIFFERENT SHADES OF BLUE (dark → light as series index grows).
export const BLUE_PALETTE = [
  "#1E3A8A", // dark navy blue   — series 1
  "#274690",
  "#3156A3",
  "#3B66B6",
  "#4678C5",
  "#5189D0",
  "#5A9BD0",
  "#64AAD5", // light blue       — series 8
];

// SPECTRUM_PALETTE — categorical segments that need clearly distinct colors.
// Color-wheel progression: PURPLE → MAGENTA → RED → ORANGE → YELLOW → GREEN.
// Never mix blue into a categorical visualization.
export const SPECTRUM_PALETTE = [
  "#7E22CE", // purple
  "#A21CAF", // magenta-purple
  "#C026D3", // magenta/fuchsia
  "#E11D48", // rose red
  "#F43F5E", // red
  "#F97316", // orange
  "#F59E0B", // amber
  "#EAB308", // yellow
  "#84CC16", // lime
  "#22C55E", // green
];

// Backwards-compatible chart palettes — normal-series blue slices
export const CHART_COLORS_5 = BLUE_PALETTE.slice(0, 5);
export const CHART_COLORS_6 = BLUE_PALETTE.slice(0, 6);

// Entity colors — used for stat cards, icons, badges (blue shades)
export const ENTITY_COLORS = {
  cities: "#5B8AFF",
  routes: "#2E5CFF",
  stops: "#1A3FCC",
  schedules: "#7DA2FF",
  passengers: "#7DD3FC",
  drivers: "#93C5FD",
  vehicles: "#4D7AFF",
};