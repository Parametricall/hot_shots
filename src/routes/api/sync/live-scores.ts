import { createFileRoute } from "@tanstack/react-router";
import { getDeadline, waitUntil } from "@vercel/functions";
import { getSupabaseServerClient } from "~/lib/supabase";
import { handleSyncRequest, liveIngestJob } from "~/features/afl-tipping/sync/handle-sync-request";

// Every method goes through the handler, which answers 405 to all but POST: a route with only POST
// would let a GET fall through to the page router and answer 200.
const handle = (request: Request) =>
  handleSyncRequest(request, {
    secret: process.env.SQUIGGLE_SYNC_SECRET,
    waitUntil,
    job: liveIngestJob({
      supabase: getSupabaseServerClient,
      now: Date.now,
      platformDeadline: () => getDeadline()?.getTime(),
    }),
  });

/**
 * Starts one live ingest run (plan 015, D3). Called every minute by Supabase `pg_cron` while a Game
 * is live or imminent, with `Authorization: Bearer ${SQUIGGLE_SYNC_SECRET}`. It answers 202 at once;
 * the run holds one Squiggle connection in `waitUntil` until just before the function's
 * `maxDuration` (300 s, `functionRules` in `vite.config.ts`).
 */
export const Route = createFileRoute("/api/sync/live-scores")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
      PUT: async ({ request }) => handle(request),
      PATCH: async ({ request }) => handle(request),
      DELETE: async ({ request }) => handle(request),
    },
  },
});
