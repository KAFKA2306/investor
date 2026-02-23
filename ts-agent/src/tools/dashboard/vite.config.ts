import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/investor/
  base: "/investor/",
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
