/**
 * Runs the Squiggle sync once (plan 015): loads what our tables hold, asks Squiggle only for what
 * is due, and stores the answers. The first run against an empty database fills the Games, Teams,
 * Ladder and some Model tips; run again at once, it sends few or no requests.
 *
 * Usage:
 *   npm run sync:squiggle              (the local Supabase)
 *   npm run sync:squiggle -- --remote  (any other Supabase: production's backfill, Step 13)
 *
 * Reads SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SECRET_KEY and SQUIGGLE_CONTACT_EMAIL from
 * .env (`tsx --env-file`); variables already in the environment win. Without a contact email it
 * sends nothing to Squiggle. It prints a summary and never the keys or the email.
 */

import { createClient } from "@supabase/supabase-js";
import { runSquiggleSync } from "~/features/afl-tipping/sync/run-squiggle-sync";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !secretKey) {
  console.error("Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY in .env.");
  process.exit(1);
}
if (!LOCAL_HOSTS.has(new URL(supabaseUrl).hostname) && !process.argv.includes("--remote")) {
  console.error(
    `${new URL(supabaseUrl).host} is not a local Supabase. Pass --remote to sync it on purpose.`,
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const result = await runSquiggleSync({ supabase, now: Date.now() });

if (!result.ok) {
  console.error(`Sync did not run: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
  process.exit(1);
}
console.log(`Sent ${result.requests} request(s) to Squiggle.`);
for (const job of result.jobs) {
  const outcome = job.ok ? "ok" : `FAILED ${job.reason ?? ""} ${job.detail ?? ""}`.trim();
  console.log(`  ${job.job}: ${outcome} (${job.requests} request(s))`);
}
if (result.jobs.some((job) => !job.ok)) process.exit(1);
