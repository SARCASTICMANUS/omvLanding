/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e8fdf2",
          100: "#c7f9de",
          200: "#91f1bf",
          300: "#51e29a",
          400: "#1ccb75",
          500: "#05af60",
          600: "#009849",
          700: "#007b44",
          800: "#00653a",
          900: "#003923",
        },
      },
      fontFamily: {
        manrope: [
          "Manrope",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      keyframes: {
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "hook-in": {
          "0%": { opacity: "0", transform: "translateY(60%)", filter: "blur(10px)" },
          "60%": { opacity: "1", transform: "translateY(-4%)", filter: "blur(0)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "lang-fade": {
          "0%": { opacity: "0", transform: "translateY(6px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        "shine": {
          "0%": { transform: "translateX(-150%) skewX(-20deg)" },
          "60%, 100%": { transform: "translateX(250%) skewX(-20deg)" },
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow:
              "0 6px 20px -6px rgba(0,152,73,0.6), 0 0 0 0 rgba(0,152,73,0.45)",
          },
          "50%": {
            boxShadow:
              "0 6px 30px -4px rgba(0,152,73,0.85), 0 0 0 10px rgba(0,152,73,0)",
          },
        },
      },
      animation: {
        "hook-in":
          "hook-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both, gradient-shift 6s ease-in-out infinite",
        "lang-fade": "lang-fade 300ms ease-out both",
        "spin-slow": "spin-slow 6s linear infinite",
        "shine": "shine 2.6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
