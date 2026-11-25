import { createFileRoute } from "@tanstack/react-router";
import { waitUntil } from "@vercel/functions";
import {
  handleSyncRequest,
  squiggleSyncJob,
} from "~/features/afl-tipping/sync/handle-sync-request";
import { getSupabaseServerClient } from "~/lib/supabase";

// Every method goes through the handler, which answers 405 to all but POST: a route with only POST
// would let a GET fall through to the page router and answer 200.
const handle = (request: Request) =>
  handleSyncRequest(request, {
    secret: process.env.SQUIGGLE_SYNC_SECRET,
    waitUntil,
    job: squiggleSyncJob({ supabase: getSupabaseServerClient, now: Date.now }),
  });

/**
 * Starts one Squiggle sync (plan 015). Called every 10 minutes by Supabase `pg_cron` with
 * `Authorization: Bearer ${SQUIGGLE_SYNC_SECRET}`; it takes no parameters, because the sync's plan
 * decides what is due. It answers 202 at once and the sync runs on in `waitUntil`.
 */
export const Route = createFileRoute("/api/sync/squiggle")({
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
