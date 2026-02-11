import path from "node:path";
import { defineMain } from "@storybook/react-vite/node";
export default defineMain({
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
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
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@clerk/tanstack-react-start": path.resolve(
        __dirname,
        "./mocks/clerk.ts",
      ),
    };
    return config;
  },
});
