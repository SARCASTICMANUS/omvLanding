/** @type {import('tailwindcss').Config} */
const vayyScreens = {
  xs: "375px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
  "3xl": "1920px",
  "4k": "2560px",
};

const vayyColors = {
  primary: "#009849",
  primaryHover: "#007b44",
  live: "#00E676",
  surface: "#ffffff",
  canvas: "#f8fafc",
  ink: "#0f172a",
  muted: "#64748b",
  dark: "#171717",
  tracking: "#020617",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#2563eb",
};

const vayySpacing = {
  safe: "max(1rem, env(safe-area-inset-left))",
  "screen-x": "clamp(1rem, 2.5vw, 2rem)",
  "screen-y": "clamp(1rem, 2vw, 1.75rem)",
  "section-y": "clamp(2rem, 5vw, 5rem)",
  "panel-gap": "clamp(0.75rem, 1.5vw, 1.5rem)",
  "nav-h": "5rem",
  "control": "3rem",
  "control-sm": "2.5rem",
};

const vayyRadius = {
  vayy: "18px",
  panel: "18px",
  control: "14px",
  card: "18px",
};

const vayyShadows = {
  panel: "0 18px 45px rgba(15, 23, 42, 0.10)",
  control: "0 10px 28px rgba(15, 23, 42, 0.12)",
  tracking: "0 20px 60px rgba(2, 6, 23, 0.45)",
  glow: "0 0 24px rgba(0, 230, 118, 0.35)",
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    screens: vayyScreens,
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.25rem",
        lg: "1.5rem",
        xl: "2rem",
        "2xl": "2.5rem",
        "3xl": "4rem",
        "4k": "6rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
        "3xl": "1680px",
        "4k": "2240px",
      },
    },
    extend: {
      colors: {
        brand: vayyColors,
        vayy: vayyColors,
        live: vayyColors.live,
        tracking: vayyColors.tracking,
        // Preserve existing project classes that use indigo as the green brand ramp.
        indigo: {
          50: "#e8fdf2",
          100: "#c7f9de",
          200: "#91f1bf",
          300: "#51e29a",
          400: "#1ccb75",
          500: "#05af60",
          600: "#00E676",
          700: "#009c53",
          800: "#007b44",
          900: "#00653a",
          950: "#003923",
        },
      },
      spacing: vayySpacing,
      borderRadius: vayyRadius,
      boxShadow: vayyShadows,
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        display: ["clamp(2.5rem, 5vw, 5rem)", { lineHeight: "0.98", fontWeight: "900", letterSpacing: "0" }],
        "display-sm": ["clamp(2rem, 4vw, 3.5rem)", { lineHeight: "1.02", fontWeight: "900", letterSpacing: "0" }],
        "title-lg": ["clamp(1.5rem, 2.5vw, 2.25rem)", { lineHeight: "1.1", fontWeight: "800", letterSpacing: "0" }],
        "title-md": ["clamp(1.25rem, 2vw, 1.75rem)", { lineHeight: "1.18", fontWeight: "800", letterSpacing: "0" }],
        "body-fluid": ["clamp(0.875rem, 1vw, 1rem)", { lineHeight: "1.6", fontWeight: "500", letterSpacing: "0" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.2", fontWeight: "800", letterSpacing: "0.08em" }],
      },
      maxWidth: {
        app: "1440px",
        "app-wide": "1680px",
        "app-4k": "2240px",
      },
      minHeight: {
        "screen-dvh": "100dvh",
      },
      height: {
        "screen-dvh": "100dvh",
      },
      zIndex: {
        base: "0",
        map: "5",
        panel: "10",
        nav: "50",
        overlay: "1000",
        modal: "1100",
        toast: "1200",
      },
    },
  },
  plugins: [],
};

export { vayyScreens, vayyColors, vayySpacing, vayyRadius, vayyShadows };
