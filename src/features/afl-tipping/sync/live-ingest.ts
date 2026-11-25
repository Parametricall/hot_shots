import type { SupabaseClient } from "@supabase/supabase-js";
import { SQUIGGLE_SSE_HOST } from "~/features/afl-tipping/api/squiggle/constants";
import {
  parseSseEvent,
  type LiveGameUpdate,
} from "~/features/afl-tipping/api/squiggle/sse-schemas";
import { buildSquiggleUserAgent } from "~/features/afl-tipping/api/squiggle/user-agent";
import {
  createLiveIngestStore,
  type LiveGamePatch,
  type LiveGameState,
  type LiveIngestStore,
} from "~/features/afl-tipping/sync/live-ingest.store";
import { parseSseStream } from "~/features/afl-tipping/sync/parse-sse-stream";

/** Why a run that did its job stopped. */
export type LiveIngestStop = "deadline" | "aborted" | "idle" | "lease-held";

export type RunLiveIngestResult =
  | { ok: true; connections: number; stopped: LiveIngestStop }
  | { ok: false; reason: string; detail?: string };

/** A connection to the Event API: its text chunks, or why it could not be opened. */
export type LiveConnection =
  | { ok: true; chunks: AsyncIterable<string> }
  | { ok: false; reason: string; detail?: string; retry: boolean };

/** What the ingest touches outside itself. Every one has a real default; tests replace them. */
export type LiveIngestDeps = {
  store: LiveIngestStore;
  connect: (
    url: string,
    headers: Record<string, string>,
    signal: AbortSignal,
  ) => Promise<LiveConnection>;
  now: () => number;
  /** Resolves after `ms`, or as soon as `signal` aborts. Never rejects. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Names this run on the lease. */
  holder: string;
  url: string;
  /** `SQUIGGLE_CONTACT_EMAIL`. Never logged. */
  contactEmail: string | undefined;
};

/** How long the lease lasts: a run stops at about 290 s, so a crashed run frees it by 295 s. */
export const LIVE_LEASE_SECONDS = 295;
export const LIVE_INITIAL_BACKOFF_MS = 2_000;
export const LIVE_MAX_BACKOFF_MS = 30_000;
/** How often an open connection asks the database whether any Game is still live or imminent. */
export const LIVE_WINDOW_RECHECK_MS = 60_000;

function sleepWithTimeout(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/** Opens the Event API with `fetch`. A 4xx other than 429 is not worth retrying. */
async function connectWithFetch(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<LiveConnection> {
  let response: Response;
  try {
    response = await fetch(url, { headers, signal });
  } catch (error) {
    return {
      ok: false,
      reason: "connect-error",
      detail: error instanceof Error ? error.message : String(error),
      retry: true,
    };
  }
  if (!response.ok || response.body === null) {
    void response.body?.cancel().catch(() => {});
    return {
      ok: false,
      reason: `http-${response.status}`,
      retry: response.ok || response.status === 429 || response.status >= 500,
    };
  }
  const body = response.body;
  async function* chunks() {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      void reader.cancel().catch(() => {});
    }
  }
  return { ok: true, chunks: chunks() };
}

/** Who won, from the final scores: the Home team, the Away team, or nobody in a Draw. */
function winnerFromScores(
  homeTeamId: number | null,
  awayTeamId: number | null,
  homeScore: number | null,
  awayScore: number | null,
): number | null {
  if (homeScore == null || awayScore == null) return null;
  if (homeScore > awayScore) return homeTeamId;
  if (awayScore > homeScore) return awayTeamId;
  return null;
}

/**
 * The columns one update changes, or `null` if it carries no live field. Only the live fields the
 * update has are written (ADR 0005). An update that lands `complete: 100` with no winner gets one
 * from the scores, a Draw's being none: the same rule as the browser's `applyLiveGameUpdate`.
 */
export function toLivePatch(
  update: LiveGameUpdate,
  game: LiveGameState,
  now: number,
): LiveGamePatch | null {
  const patch: Omit<LiveGamePatch, "live_updated_at"> = {};
  if (update.homeScore !== undefined) patch.home_score = update.homeScore;
  if (update.awayScore !== undefined) patch.away_score = update.awayScore;
  if (update.timeStr !== undefined) patch.time_str = update.timeStr;
  if (update.complete !== undefined) patch.complete = update.complete;
  if (update.winnerTeamId !== undefined) patch.winner_team_id = update.winnerTeamId;

  if (update.complete === 100 && update.winnerTeamId === undefined) {
    patch.winner_team_id = winnerFromScores(
      game.homeTeamId,
      game.awayTeamId,
      update.homeScore ?? game.homeScore,
      update.awayScore ?? game.awayScore,
    );
  }
  if (Object.keys(patch).length === 0) return null;
  return { ...patch, live_updated_at: new Date(now).toISOString() };
}

/**
 * The live ingest (plan 015, D3): one Squiggle Event API connection for the whole site, writing
 * live fields to `afl_games`. It knows nothing about Vercel: the caller passes an abort `signal` and
 * a `deadline` (epoch ms) after which it must have stopped and released the lease.
 *
 * - One run at a time: it takes the lease first, and a held lease means no connection and no run
 *   row. It always gives the lease up and records one `live` row in `squiggle_sync_runs`, whose
 *   `requests` is the connections opened.
 * - It only connects while a Game is unfinished and started between 6 h ago and 30 min from now,
 *   checked before every connection and every minute while one is open.
 * - A dropped connection reconnects after 2, 4, 8 ... 30 s (Squiggle's Event API "rarely but
 *   occasionally restarts"; its `id:` lines are random, so there is nothing to resume from, and
 *   the `game` snapshot sent on connect closes any gap). A 4xx other than 429 stops the run.
 * - It never logs or records the contact email.
 */
export async function runLiveIngest({
  signal,
  deadline,
  supabase,
  deps: overrides,
}: {
  signal: AbortSignal;
  deadline: number;
  /** Builds the default store. Not needed when `deps.store` is given. */
  supabase?: SupabaseClient;
  deps?: Partial<LiveIngestDeps>;
}): Promise<RunLiveIngestResult> {
  const store = overrides?.store ?? (supabase ? createLiveIngestStore(supabase) : undefined);
  if (store === undefined) return { ok: false, reason: "no-store" };
  const deps: LiveIngestDeps = {
    connect: connectWithFetch,
    now: Date.now,
    sleep: sleepWithTimeout,
    holder: crypto.randomUUID(),
    url: `${SQUIGGLE_SSE_HOST}/events`,
    contactEmail: process.env.SQUIGGLE_CONTACT_EMAIL,
    ...overrides,
    store,
  };

  const userAgent = buildSquiggleUserAgent(deps.contactEmail);
  if (userAgent === undefined) return { ok: false, reason: "no-contact-email" };
  const headers = { "User-Agent": userAgent, Accept: "text/event-stream" };

  const lease = await deps.store.acquireLease(deps.holder, LIVE_LEASE_SECONDS);
  if (!lease.ok) return lease;
  if (!lease.acquired) return { ok: true, connections: 0, stopped: "lease-held" };

  const startedAt = deps.now();
  let connections = 0;
  let connectedOnce = false;
  let writeFailures = 0;
  let stopped: LiveIngestStop | undefined;
  let failure: { reason: string; detail?: string } | undefined;

  async function apply(update: LiveGameUpdate) {
    const found = await deps.store.getGame(update.gameId);
    if (!found.ok) return void writeFailures++;
    if (found.game === null) return;
    const patch = toLivePatch(update, found.game, deps.now());
    if (patch === null) return;
    const written = await deps.store.updateGame(update.gameId, patch);
    if (!written.ok) writeFailures++;
  }

  /** Reads one open connection to its end. Returns whether it delivered anything. */
  async function consume(chunks: AsyncIterable<string>, link: AbortSignal): Promise<boolean> {
    const aborted = new Promise<"aborted">((resolve) => {
      if (link.aborted) resolve("aborted");
      else link.addEventListener("abort", () => resolve("aborted"), { once: true });
    });
    const iterator = parseSseStream(chunks)[Symbol.asyncIterator]();
    let delivered = false;
    for (;;) {
      const pending = iterator.next();
      pending.catch(() => {});
      const next = await Promise.race([pending, aborted]);
      if (next === "aborted") {
        void iterator.return(undefined).catch(() => {});
        return delivered;
      }
      if (next.done) return delivered;
      delivered = true;
      const update = parseSseEvent(next.value.event, next.value.data);
      if (update !== null) await apply(update);
    }
  }

  try {
    let backoff = LIVE_INITIAL_BACKOFF_MS;
    while (stopped === undefined && failure === undefined) {
      if (signal.aborted) {
        stopped = "aborted";
        break;
      }
      if (deps.now() >= deadline) {
        stopped = "deadline";
        break;
      }
      const window = await deps.store.hasLiveOrImminentGame(deps.now());
      if (!window.ok) {
        failure = { reason: window.reason, ...(window.detail ? { detail: window.detail } : {}) };
        break;
      }
      if (!window.active) {
        stopped = "idle";
        break;
      }

      // `link` ends this connection: on the caller's abort, at the deadline, or when nothing is live.
      const link = new AbortController();
      const onAbort = () => link.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      let watchStop: "deadline" | "idle" | undefined;
      const watch = (async () => {
        while (!link.signal.aborted) {
          await deps.sleep(
            Math.max(0, Math.min(LIVE_WINDOW_RECHECK_MS, deadline - deps.now())),
            link.signal,
          );
          if (link.signal.aborted) return;
          if (deps.now() >= deadline) {
            watchStop = "deadline";
            return link.abort();
          }
          const recheck = await deps.store.hasLiveOrImminentGame(deps.now());
          if (recheck.ok && !recheck.active) {
            watchStop = "idle";
            return link.abort();
          }
        }
      })();

      let delivered = false;
      connections++;
      try {
        const connection = await deps.connect(deps.url, headers, link.signal);
        if (connection.ok) {
          connectedOnce = true;
          delivered = await consume(connection.chunks, link.signal);
        } else if (!connection.retry && !link.signal.aborted) {
          failure = {
            reason: connection.reason,
            ...(connection.detail ? { detail: connection.detail } : {}),
          };
        }
      } catch (error) {
        if (!link.signal.aborted) {
          console.warn(
            "[live-ingest] connection dropped:",
            error instanceof Error ? error.name : "error",
          );
        }
      } finally {
        link.abort();
        signal.removeEventListener("abort", onAbort);
        await watch;
      }

      if (watchStop !== undefined) stopped = watchStop;
      else if (signal.aborted) stopped = "aborted";
      else if (failure === undefined) {
        if (delivered) backoff = LIVE_INITIAL_BACKOFF_MS;
        await deps.sleep(Math.max(0, Math.min(backoff, deadline - deps.now())), signal);
        backoff = Math.min(backoff * 2, LIVE_MAX_BACKOFF_MS);
      }
    }
  } finally {
    const released = await deps.store.releaseLease(deps.holder).catch(() => undefined);
    if (released === undefined || !released.ok) {
      console.error("[live-ingest] could not release the lease");
    }
    const ok = failure === undefined && (connectedOnce || connections === 0);
    const reason = failure?.reason ?? (ok ? stopped : "connect-failed");
    const detail =
      failure?.detail ?? (writeFailures > 0 ? `${writeFailures} write(s) failed` : undefined);
    const recorded = await deps.store
      .insertRun({
        startedAt,
        finishedAt: deps.now(),
        ok,
        ...(reason === undefined ? {} : { reason }),
        ...(detail === undefined ? {} : { detail: detail.slice(0, 500) }),
        requests: connections,
      })
      .catch(() => undefined);
    if (recorded === undefined || !recorded.ok) {
      console.error("[live-ingest] could not record the run");
    }
  }

  if (failure !== undefined) return { ok: false, ...failure };
  if (connections > 0 && !connectedOnce) return { ok: false, reason: "connect-failed" };
  return { ok: true, connections, stopped: stopped ?? "deadline" };
}
