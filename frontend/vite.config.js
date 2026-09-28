import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// Base path for all built asset URLs, router basename, and public asset paths.
// Local dev defaults to "/" (http://localhost:5173/).
// The Docker production build sets BASE_PATH=/omv/ so the SPA is served under
// https://onmyvayy.com/omv/. Always include leading + trailing slashes when set.
const base = process.env.BASE_PATH || "/";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
    host: true, // needed for the Docker Container port mapping to work
    strictPort: true,
    port: 5173,
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.googleusercontent.com; connect-src 'self' ws: wss: http: https:; frame-src https://accounts.google.com; worker-src 'self' blob:;",
    },
  },
});
