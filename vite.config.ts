// vite.config.ts
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => ({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      router: { entry: "./app/router" },
      start: { entry: "./app/start" },
    }),
    mode === "development" && devtools(),
    nitro(),
    viteReact(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          clerk: ["@clerk/tanstack-react-start", "@clerk/react", "@clerk/shared"],
          router: [
            "@tanstack/react-router",
            "@tanstack/react-start",
            "@tanstack/react-router-with-query",
          ],
          query: [
            "@tanstack/react-query",
            "@tanstack/react-query-persist-client",
            "@tanstack/query-async-storage-persister",
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["cookie"],
  },
  resolve: {
    alias: [
      {
        find: "use-sync-external-store/shim/index.js",
        replacement: "react",
      },
    ],
  },
}));
