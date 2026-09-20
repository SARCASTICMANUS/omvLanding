// Memphis Design System — Single Source of Truth
// =================================================

// Core palette — CSS variables defined in index.css
export const MEMPHIS_PINK = "#FF71CE";
export const MEMPHIS_YELLOW = "#FFCE5C";
export const MEMPHIS_TEAL = "#86CCCA";
export const MEMPHIS_PURPLE = "#6A7BB4";
export const MEMPHIS_INK = "#16121F";
export const MEMPHIS_PAPER = "#FAF6EE";
export const MEMPHIS_MINT = "#7BE0AD";
export const MEMPHIS_CORAL = "#FF5D5D";
export const MEMPHIS_LIME = "#C7F464";

// Functional modifiers — controlled opacity for data-heavy contexts
export const MEMPHIS_PINK_5 = "#FF71CE0D";    // pink/5  — table row hover
export const MEMPHIS_PINK_10 = "#FF71CE1A";   // pink/10 — subtle tint
export const MEMPHIS_TEAL_10 = "#86CCCA1A";   // teal/10
export const MEMPHIS_YELLOW_10 = "#FFCE5C1A"; // yellow/10
export const MEMPHIS_PURPLE_10 = "#6A7BB41A"; // purple/10
export const MEMPHIS_MINT_10 = "#7BE0AD1A";   // mint/10
export const MEMPHIS_CORAL_10 = "#FF5D5D1A";  // coral/10
export const MEMPHIS_INK_5 = "#16121F0D";     // ink/5 — faint borders
export const MEMPHIS_INK_10 = "#16121F1A";    // ink/10 — table borders
export const MEMPHIS_PURPLE_20 = "#6A7BB433"; // purple/20 — chart gridlines

// Status semantics
export const STATUS_ACTIVE = "#7BE0AD";  // mint — live/active/running
export const STATUS_PAUSED = "#FFCE5C";  // yellow — paused/pending
export const STATUS_ERROR = "#FF5D5D";   // coral — errors/blocked/cancelled
export const STATUS_INACTIVE = "#6A7BB480"; // purple/50 — inactive/disabled

// Memphis tints (for backgrounds) — kept for backward compat
export const MEMPHIS_PINK_TINT = MEMPHIS_PINK_10;
export const MEMPHIS_TEAL_TINT = MEMPHIS_TEAL_10;
export const MEMPHIS_YELLOW_TINT = MEMPHIS_YELLOW_10;
export const MEMPHIS_PURPLE_TINT = MEMPHIS_PURPLE_10;
export const MEMPHIS_MINT_TINT = MEMPHIS_MINT_10;
export const MEMPHIS_CORAL_TINT = MEMPHIS_CORAL_10;

// Route colors — 14 Memphis-themed color sets for route map display
export const ROUTE_COLORS = [
  { line: "#FF71CE", bg: "#FF71CE1A", text: "#cc5aa5", dot: "#FF71CE" },
  { line: "#86CCCA", bg: "#86CCCA1A", text: "#5e9e9c", dot: "#86CCCA" },
  { line: "#FFCE5C", bg: "#FFCE5C1A", text: "#b8952e", dot: "#FFCE5C" },
  { line: "#6A7BB4", bg: "#6A7BB41A", text: "#4d5a8a", dot: "#6A7BB4" },
  { line: "#7BE0AD", bg: "#7BE0AD1A", text: "#4eb37e", dot: "#7BE0AD" },
  { line: "#FF5D5D", bg: "#FF5D5D1A", text: "#cc3a3a", dot: "#FF5D5D" },
  { line: "#C7F464", bg: "#C7F4641A", text: "#8aab3a", dot: "#C7F464" },
  { line: "#E85BB4", bg: "#E85BB41A", text: "#b33d8a", dot: "#E85BB4" },
  { line: "#6BC5D2", bg: "#6BC5D21A", text: "#429aa5", dot: "#6BC5D2" },
  { line: "#FFB347", bg: "#FFB3471A", text: "#c8821e", dot: "#FFB347" },
  { line: "#9B8FD4", bg: "#9B8FD41A", text: "#6e63a8", dot: "#9B8FD4" },
  { line: "#5DD4A0", bg: "#5DD4A01A", text: "#34a873", dot: "#5DD4A0" },
  { line: "#FF8A8A", bg: "#FF8A8A1A", text: "#cc5e5e", dot: "#FF8A8A" },
  { line: "#D4E157", bg: "#D4E1571A", text: "#a0ad2e", dot: "#D4E157" },
];

// Chart colors — Memphis palette
export const CHART_COLORS_5 = [
  "#FF71CE",
  "#FFCE5C",
  "#86CCCA",
  "#FF5D5D",
  "#6A7BB4",
];
export const CHART_COLORS_6 = [
  "#FF71CE",
  "#FFCE5C",
  "#86CCCA",
  "#FF5D5D",
  "#6A7BB4",
  "#7BE0AD",
];

// Entity colors — used for stat cards, icons, badges
export const ENTITY_COLORS = {
  cities: "#86CCCA",
  routes: "#FF71CE",
  stops: "#6A7BB4",
  schedules: "#FFCE5C",
  passengers: "#7BE0AD",
  drivers: "#FF5D5D",
  vehicles: "#C7F464",
};
