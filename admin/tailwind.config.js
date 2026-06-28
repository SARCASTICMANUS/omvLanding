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
    },
  },
  plugins: [],
};
