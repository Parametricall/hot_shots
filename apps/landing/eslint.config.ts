import { defineConfig } from "eslint/config";
import { base } from "@hot-shots/eslint-config";

export default defineConfig([
  {
    ignores: [".output", ".tanstack", "package.json", "package-lock.json"],
  },
  ...base,
]);
