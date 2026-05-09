/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
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
    },
  },
  plugins: [],
};
