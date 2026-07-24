// vite.config.ts
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    host: true,
    port: 3001,
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      router: { entry: "./app/router" },
      start: { entry: "./app/start" },
      serverFns: {
        disableCsrfMiddlewareWarning: true,
      },
    }),
    nitro({
      // Temporary (307) redirects for installed-PWA users of the AFL app,
      // which has moved to afl.hot-shots.dev. Flip to a permanent redirect
      // only once rollback is inconceivable - browsers cache 308s forever.
      routeRules: {
        "/afl-tipping": { redirect: "https://afl.hot-shots.dev/afl-tipping/tips" },
        "/afl-tipping/**": { redirect: "https://afl.hot-shots.dev/afl-tipping/**" },
        "/sign-in": { redirect: "https://afl.hot-shots.dev/sign-in" },
        "/sign-in/**": { redirect: "https://afl.hot-shots.dev/sign-in/**" },
        "/sign-up": { redirect: "https://afl.hot-shots.dev/sign-up" },
      },
    }),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
