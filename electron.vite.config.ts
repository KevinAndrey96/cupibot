import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "desktop/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "desktop/main/preload.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "desktop/renderer"),
    base: "./",
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: false,
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "desktop/renderer/index.html"),
        },
      },
    },
  },
});
