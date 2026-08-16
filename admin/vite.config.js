import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = (env.VITE_API_URL || "/api").trim();
  const proxyTarget = (env.VITE_API_PROXY_TARGET || "http://localhost:8000").trim();

  // Dev proxy: only needed for same-origin "/api". When VITE_API_URL is an
  // absolute URL the browser calls it directly and no proxy is required.
  const proxy = apiUrl.startsWith("http")
    ? {}
    : {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      };

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy,
    },
  };
});