import type { SupabaseClient } from "@supabase/supabase-js";
import { createSquiggleClient, type SquiggleClient } from "~/features/afl-tipping/api/squiggle/api";
import {
  MAX_REQUESTS_PER_RUN,
  planSquiggleSync,
  type SquiggleRequest,
  type SquiggleSyncJob,
} from "~/features/afl-tipping/sync/plan-squiggle-sync";
import {
  createSquiggleSyncRepository,
  type SquiggleSyncRepository,
} from "~/features/afl-tipping/sync/squiggle-sync.repository";

/** What one job did in a run. `reason` and `detail` are the first failure's, if it failed. */
export type SquiggleSyncJobSummary = {
  job: SquiggleSyncJob;
  ok: boolean;
  /** Requests sent to Squiggle for this job. */
  requests: number;
  reason?: string;
  detail?: string;
};

export type RunSquiggleSyncResult =
  | { ok: true; requests: number; jobs: SquiggleSyncJobSummary[] }
  | { ok: false; reason: string; detail?: string };

type Outcome = { ok: true } | { ok: false; reason: string; detail?: string };

/** `squiggle_sync_runs.detail` is for a person reading a log, not for a whole error body. */
const MAX_DETAIL_LENGTH = 500;

/** Sends one planned request to Squiggle and stores what it answers. */
async function execute(
  request: SquiggleRequest,
  client: SquiggleClient,
  repository: SquiggleSyncRepository,
  now: number,
): Promise<Outcome> {
  switch (request.kind) {
    case "games": {
      const fetched = await client.fetchGames(
        request.complete === undefined
          ? { year: request.year }
          : { year: request.year, complete: request.complete },
      );
      if (!fetched.ok) return fetched;
      const stored = await repository.upsertGames(fetched.games, now);
      if (!stored.ok) return stored;
      // Only a whole year's Fixture says whether Squiggle has Games for it.
      return request.complete === undefined
        ? repository.upsertFixtureCheck(request.year, fetched.games.length > 0, now)
        : stored;
    }
    case "tips": {
      const fetched = await client.fetchModelTips({ year: request.year, round: request.round });
      return fetched.ok ? repository.upsertModelTips(request.year, fetched.tips, now) : fetched;
    }
    case "ladder": {
      const fetched = await client.fetchLadder(request.year);
      return fetched.ok ? repository.upsertLadder(request.year, fetched.ladder, now) : fetched;
    }
    case "teams": {
      const fetched = await client.fetchTeams();
      return fetched.ok ? repository.upsertTeams(fetched.teams, now) : fetched;
    }
  }
}

/**
 * One Squiggle sync (plan 015): loads what our tables know, asks `planSquiggleSync` what to
 * request, sends each request through the budgeted client, stores what succeeds, and records one
 * `squiggle_sync_runs` row for each job that sent a request. Nothing planned means nothing sent and
 * no row, so a caller may run this as often as it likes.
 *
 * A request that fails stores nothing, and its job is recorded as failed (the planner then backs
 * off that job). The job's other requests, and every other job, still run. Without a contact email
 * the client sends nothing, so the run stops and records nothing rather than back every job off.
 *
 * `supabase` is a client that may write every table (the secret key). The scheduled endpoint and
 * `npm run sync:squiggle` both pass one in.
 */
export async function runSquiggleSync({
  supabase,
  now,
  client = createSquiggleClient({ budget: MAX_REQUESTS_PER_RUN }),
}: {
  supabase: SupabaseClient;
  now: number;
  client?: SquiggleClient;
}): Promise<RunSquiggleSyncResult> {
  const repository = createSquiggleSyncRepository(supabase);
  const loaded = await repository.loadState(now);
  if (!loaded.ok) return loaded;

  const plan = planSquiggleSync(loaded.state, now);
  const jobs: SquiggleSyncJobSummary[] = [];

  for (const job of new Set(plan.map((request) => request.job))) {
    const sentBefore = client.requestCount();
    let failure: Extract<Outcome, { ok: false }> | undefined;
    for (const request of plan.filter((planned) => planned.job === job)) {
      const outcome = await execute(request, client, repository, now);
      if (outcome.ok) continue;
      if (outcome.reason === "no-contact-email") {
        return { ok: false, reason: outcome.reason };
      }
      failure ??= outcome;
    }

    const requests = client.requestCount() - sentBefore;
    if (requests === 0) continue;
    const summary: SquiggleSyncJobSummary =
      failure === undefined
        ? { job, ok: true, requests }
        : {
            job,
            ok: false,
            requests,
            reason: failure.reason,
            ...(failure.detail === undefined ? {} : { detail: failure.detail }),
          };
    jobs.push(summary);

    const recorded = await repository.insertRun({
      job,
      startedAt: now,
      finishedAt: Date.now(),
      ok: summary.ok,
      ...(summary.reason === undefined ? {} : { reason: summary.reason }),
      ...(summary.detail === undefined
        ? {}
        : { detail: summary.detail.slice(0, MAX_DETAIL_LENGTH) }),
      requests,
    });
    if (!recorded.ok) {
      console.error("[squiggle-sync] could not record a run", { job, reason: recorded.reason });
    }
  }

  return { ok: true, requests: jobs.reduce((sum, job) => sum + job.requests, 0), jobs };
}
