// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import pluginStorybook from "eslint-plugin-storybook";

import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig, globalIgnores, type Config } from "eslint/config";
import pluginQuery from "@tanstack/eslint-plugin-query";
import { base } from "@hot-shots/eslint-config";

export default defineConfig([
  globalIgnores(["!.storybook"], "Include Storybook Directory"),
  {
    ignores: [
      ".github",
      ".claude",
      ".agents",
      "CLAUDE.md",
      ".output",
      "components.json",
      ".tanstack",
      "package.json",
      "package-lock.json",
      "README.md",
      "**/*.css",
      "tsconfig.json",
    ],
  },
  pluginQuery.configs["flat/recommended"],
  ...base,
  // eslint-plugin-storybook's rule types don't line up with this eslint
  // version's RuleDefinition shape; the config itself is valid at runtime.
  pluginStorybook.configs["flat/recommended"] as Config,
  {
    files: ["*.stories.tsx", "*.stories.ts"], // adjust as needed
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.json"],
    ignores: ["package-lock.json"],
    plugins: { json },
    language: "json/json",
    extends: ["json/recommended"],
  },
  {
    files: ["**/*.md"],
    plugins: { markdown },
    language: "markdown/gfm",
    extends: ["markdown/recommended"],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    language: "css/css",
    extends: ["css/recommended"],
  },
]);
