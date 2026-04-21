import path from "node:path";
import { defineMain } from "@storybook/react-vite/node";
import { fileURLToPath } from "node:url";

const dirname =
  typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

export default defineMain({
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: (config) => {
    const resolve = config.resolve ?? {};
    const existingAlias = resolve.alias;
    const existingAliases = Array.isArray(existingAlias)
      ? existingAlias
      : existingAlias
        ? Object.entries(existingAlias).map(([find, replacement]) => ({
            find,
            replacement: replacement as string,
          }))
        : [];
    config.resolve = {
      ...resolve,
      tsconfigPaths: true,
      // Use regex for exact match so `@clerk/tanstack-react-start/server` isn't
      // prefix-matched into `./mocks/clerk.tsx/server`.
      alias: [
        ...existingAliases,
        {
          find: /^@clerk\/tanstack-react-start\/server$/,
          replacement: path.resolve(dirname, "./mocks/clerk-server.ts"),
        },
        {
          find: /^@clerk\/tanstack-react-start$/,
          replacement: path.resolve(dirname, "./mocks/clerk.tsx"),
        },
      ],
    };
    // Server-oriented modules reach for `process.env` at module load. The browser
    // has no `process`, so inject a safe empty replacement.
    config.define = {
      ...config.define,
      // "process.env": "({})",
    };
    return config;
  },
});
