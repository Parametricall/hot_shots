import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeSyncRequest } from "~/features/afl-tipping/sync/authorize-sync-request";
import { runLiveIngest } from "~/features/afl-tipping/sync/live-ingest";
import { runSquiggleSync } from "~/features/afl-tipping/sync/run-squiggle-sync";

/** What the live ingest keeps back from the platform's kill time, so it can release its lease. */
export const LIVE_INGEST_DEADLINE_MARGIN_MS = 10_000;
/** The live endpoint's `maxDuration` is 300 s (`functionRules` in `vite.config.ts`). */
export const LIVE_INGEST_MAX_DURATION_MS = 300_000;

type SyncRequestDeps = {
  /** `SQUIGGLE_SYNC_SECRET`. */
  secret: string | undefined;
  /** Keeps the function alive for the promise after the response is sent (Vercel's `waitUntil`). */
  waitUntil: (work: Promise<unknown>) => void;
  /** The work. It reports its own failures: a rejection here is only logged. */
  job: () => Promise<void>;
};

/**
 * The shared shape of `/api/sync/*` (plan 015): `POST` only, bearer-secret authorized, answers 202
 * at once and does the work in `waitUntil`. `pg_net` gives up after a few seconds, but a Vercel
 * function lives on until its `maxDuration` while `waitUntil` work runs.
 */
export function handleSyncRequest(request: Request, deps: SyncRequestDeps): Response {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }
  const authorization = authorizeSyncRequest(request, deps.secret);
  if (!authorization.ok) {
    return new Response(authorization.reason, { status: authorization.status });
  }
  deps.waitUntil(
    deps.job().catch((error: unknown) => {
      console.error("[sync] job threw", error instanceof Error ? error.message : String(error));
    }),
  );
  return new Response(null, { status: 202 });
}

/**
 * The Squiggle sync as a job for `handleSyncRequest`. The log line names jobs and counts only: no
 * secret, and never the contact email.
 */
export function squiggleSyncJob({
  supabase,
  now,
}: {
  supabase: () => Promise<SupabaseClient>;
  now: () => number;
}): () => Promise<void> {
  return async () => {
    const result = await runSquiggleSync({ supabase: await supabase(), now: now() });
    if (!result.ok) {
      console.error(
        `[squiggle-sync] did not run: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`,
      );
      return;
    }
    const jobs = result.jobs
      .map(
        (job) =>
          `${job.job}=${job.ok ? "ok" : `failed:${job.reason ?? "unknown"}`}(${job.requests})`,
      )
      .join(" ");
    console.log(
      `[squiggle-sync] ok: ${result.requests} request(s)${jobs ? `; ${jobs}` : "; nothing due"}`,
    );
    for (const job of result.jobs.filter((planned) => !planned.ok && planned.detail)) {
      console.error(`[squiggle-sync] ${job.job} failed: ${job.reason}`, job.detail);
    }
  };
}

/**
 * The live ingest as a job for `handleSyncRequest`. `deadline` is the platform's kill time when it
 * has one (`getDeadline()`), otherwise the function's `maxDuration` from now; the ingest stops
 * `LIVE_INGEST_DEADLINE_MARGIN_MS` before it.
 */
export function liveIngestJob({
  now,
  platformDeadline,
}: {
  now: () => number;
  platformDeadline: () => number | undefined;
}): () => Promise<void> {
  return async () => {
    const killAt = platformDeadline() ?? now() + LIVE_INGEST_MAX_DURATION_MS;
    const deadline = killAt - LIVE_INGEST_DEADLINE_MARGIN_MS;
    const controller = new AbortController();
    const result = await runLiveIngest({ signal: controller.signal, deadline });
    if (!result.ok) {
      console.error(
        `[live-ingest] did not run: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`,
      );
      return;
    }
    console.log(`[live-ingest] ok: ${result.connections} connection(s)`);
  };
}
