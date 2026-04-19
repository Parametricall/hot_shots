// vite.config.ts
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
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
    tanstackStart({
      router: { entry: "./app/router" },
      start: { entry: "./app/start" },
    }),
    mode === "development" && devtools(),
    nitro(),
    viteReact(),
  ].filter(Boolean),
  optimizeDeps: {
    include: ["cookie"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: "use-sync-external-store/shim/index.js",
        replacement: "react",
      },
    ],
  },
}));
