import { defineConfig } from "@playwright/test";

/**
 * Playwright tests that run against a deployed site, not a local dev server. `BASE_URL`
 * names the site, e.g. the production URL in `.github/workflows/keep-supabase-awake.yml`.
 *
 * The tests so far use only the `request` fixture, so they need no browser: there's no
 * `npx playwright install` step.
 */
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error("Set BASE_URL to the site under test, e.g. BASE_URL=https://example.com");
}

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  // A cold serverless function, or a Supabase project still waking up, can fail the first try.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL },
});
