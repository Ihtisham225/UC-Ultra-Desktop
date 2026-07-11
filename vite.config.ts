import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import electron from "vite-plugin-electron/simple";

export default defineConfig(({ mode }) => ({
  // Electron loads the packaged app via file://, so asset URLs must be
  // relative — an absolute base ("/assets/...") resolves against the
  // filesystem root instead of the app's dist folder and renders blank.
  base: "./",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    host: "localhost",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    // `--mode renderer` runs the web renderer standalone (no Electron shell) —
    // handy for driving the UI in a browser against a local backend.
    ...(mode === "renderer"
      ? []
      : [
          electron({
            main: {
              entry: "electron/main.ts",
            },
            preload: {
              input: "electron/preload.ts",
            },
          }),
        ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
