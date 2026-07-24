import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.stories.tsx"],
          environment: "node",
        },
      },
      {
        resolve: { tsconfigPaths: true },
        test: {
          name: "component",
          include: ["src/**/*.test.tsx"],
          exclude: ["src/**/*.stories.tsx"],
          environment: "jsdom",
          globals: true,
          setupFiles: ["src/test/setup.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [],
        },
      },
    ],
  },
});
