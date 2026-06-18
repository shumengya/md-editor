import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@codemirror/") || id.includes("node_modules/@lezer/")) {
            return "vendor-codemirror";
          }
          if (id.includes("node_modules/highlight.js/") || id.includes("node_modules/marked")) {
            return "vendor-markdown";
          }
        },
      },
    },
  },
}));
