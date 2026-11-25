import { melbourneYear } from "~/features/afl-tipping/api/seasons";
import { FIRST_SEASON } from "~/features/afl-tipping/constants";

/**
 * What the Squiggle sync asks Squiggle for, decided from what our own tables already hold (plan
 * 015, "Request budget"). Pure: the same state and clock always give the same plan, so every rule
 * is tested without a database or a Squiggle. The runner (Step 6) loads the state, runs the plan
 * through the budgeted client and records a `squiggle_sync_runs` row per job that had work.
 *
 * Two things the state can't tell apart on its own, so read them with care:
 *
 * - A job's `lastOkAt` is when its last successful run started, and `consecutiveFailures` counts
 *   the failed runs since. A job with nothing planned records no run, so a run row means a request
 *   was made.
 * - The fixture job has three cadences (hourly, daily, a year with no Games yet), and its one
 *   `lastOkAt` can't gate them all. Each reads its own clock instead: the Games' `synced_at` for a
 *   known Season, `emptyFixtureChecks` for a year Squiggle had no Games for.
 */

export type SquiggleSyncJob = "fixture" | "model-tips" | "ladder" | "teams";

/** One Standard API request, tagged with the job whose run it belongs to. */
export type SquiggleRequest =
  | { job: "fixture"; kind: "games"; year: number; complete?: "!100" }
  | { job: "model-tips"; kind: "tips"; year: number; round: number }
  | { job: "ladder"; kind: "ladder"; year: number }
  | { job: "teams"; kind: "teams" };

/** A Game as the plan needs it. Times are epoch milliseconds. */
export type SquiggleSyncGame = {
  id: number;
  round: number;
  startTime: number;
  /** Squiggle's 0 to 100. */
  complete: number;
  /** Null until the AFL names the teams. */
  homeTeamId: number | null;
  awayTeamId: number | null;
};

/** A Season we hold Games for. A Season with no Games is left out of the state. */
export type SquiggleSyncSeason = {
  season: number;
  games: SquiggleSyncGame[];
  /** The newest `synced_at` of its Games: when any fetch last touched the Season. */
  lastSyncedAt: number;
  /**
   * The oldest `synced_at` of its Games: when the whole Season was last fetched. An incomplete-only
   * fetch leaves complete Games alone, so only a full fetch moves it.
   */
  fullySyncedAt: number;
};

export type SquiggleJobState = {
  /** When the latest run started, or null if the job has never run. */
  lastRunAt: number | null;
  /** When the latest successful run started, or null if none has succeeded. */
  lastOkAt: number | null;
  /** Failed runs since the last success. Zero when the latest run succeeded. */
  consecutiveFailures: number;
};

export type SquiggleSyncState = {
  seasons: SquiggleSyncSeason[];
  knownTeamIds: number[];
  jobs: Record<SquiggleSyncJob, SquiggleJobState>;
  /** The latest Game completion we know of, and its Season. Null if no Game is complete. */
  lastGameCompletion: { at: number; season: number } | null;
  /** When we last asked Squiggle for a year's Fixture and it had no Games, by year. */
  emptyFixtureChecks: Record<number, number>;
  /** Standard API requests recorded since midnight in Melbourne. */
  requestsToday: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Most requests one run may send. The runner's client gets this as its budget (D7). */
export const MAX_REQUESTS_PER_RUN = 10;
/** Most Standard API requests a Melbourne day may hold (D7). */
export const MAX_REQUESTS_PER_DAY = 300;

/** Backoff after a failed run of a job: 1, 2, 4 … up to 60 minutes (D7). */
export const BACKOFF_BASE_MS = MINUTE_MS;
export const BACKOFF_MAX_MS = HOUR_MS;

/** A Season counts as in-Season from this long before its next Game (see `isInSeason`). */
export const IN_SEASON_LEAD_MS = 7 * DAY_MS;
/** A Game that began this long ago has finished. A Season synced after that is final. */
export const GAME_LENGTH_ALLOWANCE_MS = 4 * HOUR_MS;

/** In-Season, refetch the Games not yet complete this often, and everything this often. */
export const FIXTURE_INCOMPLETE_INTERVAL_MS = HOUR_MS;
export const FIXTURE_RECONCILE_INTERVAL_MS = DAY_MS;
/** Ask for this year's and next year's Fixture this often until Squiggle has Games for it. */
export const NEXT_FIXTURE_INTERVAL_MS = DAY_MS;

/** Model tips for Rounds with a Game starting inside the window: this often. Otherwise daily. */
export const MODEL_TIPS_SOON_WINDOW_MS = 7 * DAY_MS;
export const MODEL_TIPS_SOON_INTERVAL_MS = HOUR_MS;
export const MODEL_TIPS_IDLE_INTERVAL_MS = DAY_MS;

/** Squiggle delays the Ladder by up to 5 minutes after a Game completes. */
export const LADDER_DELAY_AFTER_COMPLETION_MS = 10 * MINUTE_MS;
export const LADDER_RECONCILE_INTERVAL_MS = DAY_MS;

export const TEAMS_INTERVAL_MS = 7 * DAY_MS;
/**
 * A Game naming an unknown team asks for Teams at once, but no more often than this. Squiggle's
 * Teams are up to an hour stale, and a team Squiggle never lists would otherwise ask every minute.
 */
export const TEAMS_UNKNOWN_TEAM_MIN_INTERVAL_MS = HOUR_MS;

/**
 * Whether a Season is in-Season at `now`: some Game isn't complete, and some Game has started or
 * starts within `IN_SEASON_LEAD_MS`. So a Season turns in-Season a week before its first Game and
 * stays so until its last Game completes, byes and finals gaps included. A Season whose Fixture is
 * out months ahead, or whose Games are all complete, is off-Season.
 */
export function isInSeason(season: SquiggleSyncSeason, now: number): boolean {
  const unfinished = season.games.some((game) => game.complete < 100);
  const underway = season.games.some((game) => game.startTime <= now + IN_SEASON_LEAD_MS);
  return unfinished && underway;
}

/**
 * Every Game is complete and the Season was fetched in full after the last one could have ended, so
 * Squiggle has nothing left to change. Such a Season is never fetched again.
 */
function isClosed(season: SquiggleSyncSeason): boolean {
  return (
    season.games.every((game) => game.complete === 100) &&
    season.fullySyncedAt >= lastStartTime(season) + GAME_LENGTH_ALLOWANCE_MS
  );
}

function lastStartTime(season: SquiggleSyncSeason): number {
  return Math.max(...season.games.map((game) => game.startTime));
}

function isOlderThan(at: number | null, now: number, interval: number): boolean {
  return at === null || now - at >= interval;
}

/** A job that failed lately waits 1, 2, 4 … 60 minutes after its last run, by failures in a row. */
function isBackedOff(job: SquiggleJobState, now: number): boolean {
  if (job.consecutiveFailures === 0 || job.lastRunAt === null) return false;
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** (job.consecutiveFailures - 1), BACKOFF_MAX_MS);
  return now < job.lastRunAt + delay;
}

function fixtureRequest(year: number, complete?: "!100"): SquiggleRequest {
  return complete === undefined
    ? { job: "fixture", kind: "games", year }
    : { job: "fixture", kind: "games", year, complete };
}

function planFixture(state: SquiggleSyncState, now: number): SquiggleRequest[] {
  const year = melbourneYear(now);
  const seasons = state.seasons.filter((season) => season.games.length > 0);

  // First ever load: last year (its finals), this year and next year.
  if (seasons.length === 0) {
    return [year - 1, year, year + 1]
      .filter((season) => season >= FIRST_SEASON)
      .map((season) => fixtureRequest(season));
  }

  const requests: SquiggleRequest[] = [];
  for (const season of seasons.toSorted((a, b) => a.season - b.season)) {
    if (isClosed(season)) continue;
    const allComplete = season.games.every((game) => game.complete === 100);
    const lastStart = lastStartTime(season);

    if (allComplete) {
      // Finished, but not yet fetched since: one full fetch confirms it, then it is closed.
      if (now >= lastStart + GAME_LENGTH_ALLOWANCE_MS) requests.push(fixtureRequest(season.season));
    } else if (isOlderThan(season.fullySyncedAt, now, FIXTURE_RECONCILE_INTERVAL_MS)) {
      requests.push(fixtureRequest(season.season));
    } else if (
      isInSeason(season, now) &&
      isOlderThan(season.lastSyncedAt, now, FIXTURE_INCOMPLETE_INTERVAL_MS)
    ) {
      requests.push(fixtureRequest(season.season, "!100"));
    }
  }

  // This year's and next year's Fixture, until Squiggle has Games for them.
  const known = new Set(seasons.map((season) => season.season));
  for (const season of [year, year + 1]) {
    if (season < FIRST_SEASON || known.has(season)) continue;
    if (isOlderThan(state.emptyFixtureChecks[season] ?? null, now, NEXT_FIXTURE_INTERVAL_MS)) {
      requests.push(fixtureRequest(season));
    }
  }
  return requests;
}

function planLadder(state: SquiggleSyncState, now: number): SquiggleRequest[] {
  const lastOkAt = state.jobs.ladder.lastOkAt;
  const seasons = new Set<number>();

  // A Game completed since the Ladder was last read.
  const completion = state.lastGameCompletion;
  if (
    completion !== null &&
    now >= completion.at + LADDER_DELAY_AFTER_COMPLETION_MS &&
    (lastOkAt === null || lastOkAt < completion.at)
  ) {
    seasons.add(completion.season);
  }

  // Otherwise once a day while a Season is under way.
  if (isOlderThan(lastOkAt, now, LADDER_RECONCILE_INTERVAL_MS)) {
    for (const season of state.seasons) {
      if (isInSeason(season, now)) seasons.add(season.season);
    }
  }

  return [...seasons]
    .toSorted((a, b) => a - b)
    .map((year) => ({ job: "ladder", kind: "ladder", year }));
}

function planModelTips(state: SquiggleSyncState, now: number): SquiggleRequest[] {
  const unstarted = state.seasons.flatMap((season) =>
    season.games
      .filter((game) => game.startTime > now)
      .map((game) => ({ season: season.season, round: game.round, startTime: game.startTime })),
  );
  if (unstarted.length === 0) return [];

  const soon = new Map<string, { season: number; round: number }>();
  for (const game of unstarted) {
    if (game.startTime <= now + MODEL_TIPS_SOON_WINDOW_MS) {
      soon.set(`${game.season}:${game.round}`, { season: game.season, round: game.round });
    }
  }

  const lastOkAt = state.jobs["model-tips"].lastOkAt;
  if (soon.size > 0) {
    if (!isOlderThan(lastOkAt, now, MODEL_TIPS_SOON_INTERVAL_MS)) return [];
    return [...soon.values()]
      .toSorted((a, b) => a.season - b.season || a.round - b.round)
      .map(({ season, round }) => ({ job: "model-tips", kind: "tips", year: season, round }));
  }

  if (!isOlderThan(lastOkAt, now, MODEL_TIPS_IDLE_INTERVAL_MS)) return [];
  const next = unstarted.reduce((earliest, game) =>
    game.startTime < earliest.startTime ? game : earliest,
  );
  return [{ job: "model-tips", kind: "tips", year: next.season, round: next.round }];
}

function planTeams(state: SquiggleSyncState, now: number): SquiggleRequest[] {
  const lastOkAt = state.jobs.teams.lastOkAt;
  const known = new Set(state.knownTeamIds);
  const hasUnknownTeam = state.seasons.some((season) =>
    season.games.some(
      (game) =>
        (game.homeTeamId !== null && !known.has(game.homeTeamId)) ||
        (game.awayTeamId !== null && !known.has(game.awayTeamId)),
    ),
  );
  const due =
    isOlderThan(lastOkAt, now, TEAMS_INTERVAL_MS) ||
    (hasUnknownTeam && isOlderThan(lastOkAt, now, TEAMS_UNKNOWN_TEAM_MIN_INTERVAL_MS));
  return due ? [{ job: "teams", kind: "teams" }] : [];
}

/**
 * The Standard API requests to send now, most important first: fixture, then ladder, model-tips
 * and teams. A job in backoff plans nothing. The plan is empty once the day's budget is spent, and
 * never longer than the run's budget or what is left of the day's, so the lowest priority work
 * waits for the next tick.
 */
export function planSquiggleSync(state: SquiggleSyncState, now: number): SquiggleRequest[] {
  const remainingToday = MAX_REQUESTS_PER_DAY - state.requestsToday;
  if (remainingToday <= 0) return [];

  const planners: [SquiggleSyncJob, () => SquiggleRequest[]][] = [
    ["fixture", () => planFixture(state, now)],
    ["ladder", () => planLadder(state, now)],
    ["model-tips", () => planModelTips(state, now)],
    ["teams", () => planTeams(state, now)],
  ];
  return planners
    .flatMap(([job, plan]) => (isBackedOff(state.jobs[job], now) ? [] : plan()))
    .slice(0, Math.min(MAX_REQUESTS_PER_RUN, remainingToday));
}
