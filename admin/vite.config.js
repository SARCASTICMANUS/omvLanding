import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = (env.VITE_API_URL || "/api").trim();
  const proxyTarget = (env.VITE_API_PROXY_TARGET || "http://localhost:8000").trim();

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