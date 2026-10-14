import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = (env.VITE_API_URL || "/api").trim();
  const proxyTarget = (env.VITE_API_PROXY_TARGET || "http://localhost:8000").trim();

  // Public mount path for this SPA.
  //
  // MUST stay distinct from the passenger/driver SPA's base: both SPAs emit
  // content-hashed bundles under `assets/` (see manualChunks below), and the
  // omv-backend front door serves the frontend's /assets/ straight off disk.
  // If both were built at "/", the admin at /zxcv/ would request
  // /zxcv/assets/index-<hash>.js and receive the FRONTEND's bundle — a white
  // screen with no error. With "/zxcv/" each SPA owns its own subtree.
  const base = (process.env.BASE_PATH || env.BASE_PATH || "/zxcv/").trim();

  const proxy = apiUrl.startsWith("http")
    ? {}
    : {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      };

  return {
    base,
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy,
    },
    build: {
      target: "es2020",
      minify: "esbuild",
      cssMinify: "esbuild",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            maplibre: ["maplibre-gl"],
            ui: ["lucide-react"],
          },
          assetFileNames: "assets/[name]-[hash][extname]",
          chunkFileNames: "assets/[name]-[hash].js",
        },
      },
      chunkSizeWarningLimit: 500,
    },
    css: {
      devSourcemap: false,
    },
  };
});