/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        glass: {
          bg: "rgba(255,255,255,0.65)",
          "bg-strong": "rgba(255,255,255,0.80)",
          "bg-subtle": "rgba(255,255,255,0.45)",
          border: "rgba(255,255,255,0.45)",
          "border-strong": "rgba(255,255,255,0.60)",
        },
        accent: {
          primary: "rgb(var(--accent-blue-rgb, 46 92 255) / <alpha-value>)",
          "primary-light": "var(--accent-blue-light, #5B8AFF)",
          "primary-dark": "var(--accent-blue-dark, #1A3FCC)",
          lavender: "#C4B5FD",
          "lavender-light": "#DDD6FE",
          sky: "#7DD3FC",
          rose: "#FDA4AF",
        },
        surface: {
          DEFAULT: "#F0F4FF",
          dark: "#E2E8F0",
          muted: "#94A3B8",
        },
        memphis: {
          pink: "#009849",
          yellow: "#FFB020",
          teal: "#2FA97C",
          purple: "#14532D",
          ink: "#14241C",
          paper: "#F0F4FF",
          mint: "#7BE0AD",
          coral: "#FF5D5D",
          lime: "#A3E635",
        },
      },
      fontFamily: {
        display: ["Geom", "sans-serif"],
        body: ["Geom", "Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(31, 38, 135, 0.08)",
        "glass-sm": "0 4px 16px rgba(31, 38, 135, 0.06)",
        "glass-lg": "0 12px 48px rgba(31, 38, 135, 0.12)",
        "glass-inset": "inset 0 2px 4px rgba(31, 38, 135, 0.04)",
        "glass-card": "0 4px 24px rgba(31, 38, 135, 0.07), 0 1px 2px rgba(31, 38, 135, 0.04)",
      },
      backdropBlur: {
        glass: "16px",
        "glass-strong": "24px",
      },
      borderRadius: {
        glass: "20px",
        "glass-sm": "16px",
        "glass-lg": "24px",
      },
      keyframes: {
        "glass-fade-in": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glass-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "blob-float": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(10px, -15px) scale(1.05)" },
          "66%": { transform: "translate(-5px, 10px) scale(0.95)" },
        },
      },
      animation: {
        "glass-fade-in": "glass-fade-in 400ms ease-out both",
        "glass-pulse": "glass-pulse 2s ease-in-out infinite",
        "blob-float": "blob-float 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
