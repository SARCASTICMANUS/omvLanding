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

// Mirrors vayy_app/src/constants/theme.js (mobile design tokens)
const vayyColors = {
  primary: "#009849",
  primaryHover: "#007A3B",
  primaryDark: "#007A3B",
  primaryLight: "#E0F5E8",
  live: "#00E676",
  liveAccent: "#00E676",
  bikeAccent: "#009849",
  bikeLight: "#CEBBF6",
  autoAccent: "#BA7517",
  autoLight: "#FAC775",
  surface: "#ffffff",
  surfaceElevated: "#F3F4F6",
  canvas: "#F8FAF9",
  ink: "#111827",
  inkSecondary: "#374151",
  muted: "#6B7280",
  light: "#9CA3AF",
  border: "#E5E7EB",
  borderLight: "#F0F0F0",
  dark: "#171717",
  tracking: "#020617",
  warning: "#F59E0B",
  danger: "#EF4444",
  dangerLight: "#FEF2F2",
  success: "#1D9E75",
  successLight: "#DCfce7",
  successBorder: "#BBF7D0",
  star: "#FFB800",
  info: "#378ADD",
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

// Mobile theme.radius: sm 10, md 14, lg 18, xl 24, full 999 (+ sheet 32)
const vayyRadius = {
  vayy: "18px",
  panel: "18px",
  control: "14px",
  card: "18px",
  "v-sm": "10px",
  "v-md": "14px",
  "v-lg": "18px",
  "v-xl": "24px",
  "v-2xl": "28px",
  sheet: "32px",
  tab: "12px",
};

// Mobile theme.shadow: sm/md (black) + lg (green glow)
const vayyShadows = {
  panel: "0 18px 45px rgba(15, 23, 42, 0.10)",
  control: "0 10px 28px rgba(15, 23, 42, 0.12)",
  tracking: "0 20px 60px rgba(2, 6, 23, 0.45)",
  glow: "0 0 24px rgba(0, 230, 118, 0.35)",
  "v-sm": "0 1px 4px rgba(0, 0, 0, 0.04)",
  "v-md": "0 2px 8px rgba(0, 0, 0, 0.06)",
  "v-lg": "0 4px 16px rgba(0, 152, 73, 0.20)",
  "v-pop": "0 2px 10px rgba(0, 0, 0, 0.08)",
  "v-drop": "0 4px 8px rgba(0, 0, 0, 0.30)",
  "v-sheet": "0 -8px 30px rgba(0, 0, 0, 0.10)",
  "v-elev": "0 8px 24px rgba(0, 0, 0, 0.12)",
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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
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
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: `calc(var(--radius) - 4px)`,
        ...vayyRadius,
      },
      spacing: vayySpacing,
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
        // Mobile theme/typography.jsx scale
        "m-h1": ["1.75rem", { lineHeight: "1.25", fontWeight: "700", letterSpacing: "-0.5px" }],
        "m-h2": ["1.375rem", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "-0.3px" }],
        "m-h3": ["1.125rem", { lineHeight: "1.35", fontWeight: "600", letterSpacing: "0" }],
        "m-h4": ["1rem", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "0" }],
        "m-body": ["0.9375rem", { lineHeight: "1.47", fontWeight: "400", letterSpacing: "0" }],
        "m-body-sm": ["0.8125rem", { lineHeight: "1.46", fontWeight: "400", letterSpacing: "0" }],
        "m-caption": ["0.6875rem", { lineHeight: "1.36", fontWeight: "400", letterSpacing: "0" }],
        "m-label": ["0.75rem", { lineHeight: "1.4", fontWeight: "500", letterSpacing: "0.5px" }],
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
