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

// Status semantics
export const STATUS_ACTIVE = "#7BE0AD";  // mint — live/active/running
export const STATUS_PAUSED = "#FFB020";  // amber — paused/pending
export const STATUS_ERROR = "#FF5D5D";   // coral — errors/blocked/cancelled
export const STATUS_INACTIVE = "#14532D80"; // dark green/50 — inactive/disabled

// Memphis tints (for backgrounds) — kept for backward compat
export const MEMPHIS_PINK_TINT = MEMPHIS_PINK_10;
export const MEMPHIS_TEAL_TINT = MEMPHIS_TEAL_10;
export const MEMPHIS_YELLOW_TINT = MEMPHIS_YELLOW_10;
export const MEMPHIS_PURPLE_TINT = MEMPHIS_PURPLE_10;
export const MEMPHIS_MINT_TINT = MEMPHIS_MINT_10;
export const MEMPHIS_CORAL_TINT = MEMPHIS_CORAL_10;

// Route colors — 14 green-family color sets for route map display
export const ROUTE_COLORS = [
  { line: "#009849", bg: "#0098491A", text: "#007a3a", dot: "#009849" },
  { line: "#2FA97C", bg: "#2FA97C1A", text: "#1d7a59", dot: "#2FA97C" },
  { line: "#34C98F", bg: "#34C98F1A", text: "#1d9c68", dot: "#34C98F" },
  { line: "#7BE0AD", bg: "#7BE0AD1A", text: "#4eb37e", dot: "#7BE0AD" },
  { line: "#5DD4A0", bg: "#5DD4A01A", text: "#34a873", dot: "#5DD4A0" },
  { line: "#A3E635", bg: "#A3E6351A", text: "#7fa52b", dot: "#A3E635" },
  { line: "#65A30D", bg: "#65A30D1A", text: "#3f6212", dot: "#65A30D" },
  { line: "#BEF264", bg: "#BEF2641A", text: "#79a83a", dot: "#BEF264" },
  { line: "#D4E157", bg: "#D4E1571A", text: "#a0ad2e", dot: "#D4E157" },
  { line: "#FFB020", bg: "#FFB0201A", text: "#c8821e", dot: "#FFB020" },
  { line: "#FFB347", bg: "#FFB3471A", text: "#c8821e", dot: "#FFB347" },
  { line: "#FF5D5D", bg: "#FF5D5D1A", text: "#cc3a3a", dot: "#FF5D5D" },
  { line: "#14532D", bg: "#14532D1A", text: "#0f3a20", dot: "#14532D" },
  { line: "#22C55E", bg: "#22C55E1A", text: "#16a34a", dot: "#22C55E" },
];

// Chart colors — green-family palette
export const CHART_COLORS_5 = [
  "#009849",
  "#FFB020",
  "#2FA97C",
  "#FF5D5D",
  "#14532D",
];
export const CHART_COLORS_6 = [
  "#009849",
  "#FFB020",
  "#2FA97C",
  "#FF5D5D",
  "#14532D",
  "#7BE0AD",
];

// Entity colors — used for stat cards, icons, badges
export const ENTITY_COLORS = {
  cities: "#2FA97C",
  routes: "#009849",
  stops: "#14532D",
  schedules: "#FFB020",
  passengers: "#7BE0AD",
  drivers: "#FF5D5D",
  vehicles: "#A3E635",
};