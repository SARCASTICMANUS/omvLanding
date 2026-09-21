/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        memphis: {
          pink: "#FF71CE",
          yellow: "#FFCE5C",
          teal: "#86CCCA",
          purple: "#6A7BB4",
          ink: "#16121F",
          paper: "#FAF6EE",
          mint: "#7BE0AD",
          coral: "#FF5D5D",
          lime: "#C7F464",
        },
      },
      fontFamily: {
        display: ["Archivo Black", "sans-serif"],
        body: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        // Light Memphis — soft slate offset (premium sticker feel)
        "memphis-sm": "2px 2px 0 0 #cbd5e1",
        "memphis-md": "3px 3px 0 0 #cbd5e1",
        "memphis-xs": "1px 1px 0 0 #cbd5e1",
        // Keep old tokens for any remaining references
        memphis: "2px 2px 0 0 #cbd5e1",
        "memphis-hover": "3px 3px 0 0 #cbd5e1",
        "memphis-table": "1px 1px 0 0 #cbd5e1",
        "memphis-table-hover": "2px 2px 0 0 #cbd5e1",
        "memphis-lg": "4px 4px 0 0 #cbd5e1",
      },
      keyframes: {
        "memphis-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "memphis-fade-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "memphis-float": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-6px) rotate(3deg)" },
        },
        "hook-in": {
          "0%": { opacity: "0", transform: "translateY(60%)", filter: "blur(10px)" },
          "60%": { opacity: "1", transform: "translateY(-4%)", filter: "blur(0)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        "lang-fade": {
          "0%": { opacity: "0", transform: "translateY(6px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        "shine": {
          "0%": { transform: "translateX(-150%) skewX(-20deg)" },
          "60%, 100%": { transform: "translateX(250%) skewX(-20deg)" },
        },
      },
      animation: {
        "memphis-spin": "memphis-spin 1.2s linear infinite",
        "memphis-fade-in": "memphis-fade-in 420ms ease-out both",
        "memphis-float": "memphis-float 3s ease-in-out infinite",
        "hook-in":
          "hook-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "lang-fade": "lang-fade 300ms ease-out both",
        "shine": "shine 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
