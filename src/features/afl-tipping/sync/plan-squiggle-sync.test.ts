import { describe, expect, it } from "vite-plus/test";
import { melbourneYear } from "~/features/afl-tipping/api/seasons";
import {
  BACKOFF_MAX_MS,
  GAME_LENGTH_ALLOWANCE_MS,
  isInSeason,
  MAX_REQUESTS_PER_DAY,
  MAX_REQUESTS_PER_RUN,
  planSquiggleSync,
  type SquiggleJobState,
  type SquiggleRequest,
  type SquiggleSyncGame,
  type SquiggleSyncJob,
  type SquiggleSyncSeason,
  type SquiggleSyncState,
} from "~/features/afl-tipping/sync/plan-squiggle-sync";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Wednesday 25 November 2026, 2pm in Melbourne: the real off-Season. */
const OFF_SEASON_NOW = Date.parse("2026-11-25T03:00:00Z");
/** Saturday 9 May 2026, 4:30pm in Melbourne: a Game day afternoon. */
const GAME_DAY_NOW = Date.parse("2026-05-09T06:30:00Z");

let nextGameId = 1;

function game(overrides: Partial<SquiggleSyncGame> & { startTime: number }): SquiggleSyncGame {
  return {
    id: nextGameId++,
    round: 1,
    complete: 0,
    homeTeamId: 1,
    awayTeamId: 2,
    ...overrides,
  };
}

/** A Season fetched in full at `syncedAt`, and again (incomplete Games only) at `lastSyncedAt`. */
function season(
  year: number,
  games: SquiggleSyncGame[],
  syncedAt: number,
  lastSyncedAt = syncedAt,
): SquiggleSyncSeason {
  return { season: year, games, fullySyncedAt: syncedAt, lastSyncedAt };
}

function idleJob(overrides: Partial<SquiggleJobState> = {}): SquiggleJobState {
  return { lastRunAt: null, lastOkAt: null, consecutiveFailures: 0, ...overrides };
}

/** A job that last succeeded `ago` before `now`. */
function okJob(now: number, ago: number): SquiggleJobState {
  return idleJob({ lastRunAt: now - ago, lastOkAt: now - ago });
}

function makeState(
  overrides: Partial<Omit<SquiggleSyncState, "jobs">> & {
    jobs?: Partial<Record<SquiggleSyncJob, SquiggleJobState>>;
  } = {},
): SquiggleSyncState {
  const { jobs, ...rest } = overrides;
  return {
    seasons: [],
    knownTeamIds: [1, 2],
    lastGameCompletion: null,
    emptyFixtureChecks: {},
    requestsToday: 0,
    ...rest,
    jobs: {
      fixture: idleJob(),
      "model-tips": idleJob(),
      ladder: idleJob(),
      teams: idleJob(),
      ...jobs,
    },
  };
}

/** Everything fresh: no job is due at `now`, so a test adds the one thing that makes it so. */
function quietState(now: number, seasons: SquiggleSyncSeason[] = []): SquiggleSyncState {
  return makeState({
    seasons,
    jobs: {
      fixture: okJob(now, MINUTE),
      "model-tips": okJob(now, MINUTE),
      ladder: okJob(now, MINUTE),
      teams: okJob(now, MINUTE),
    },
    emptyFixtureChecks: {
      [melbourneYear(now)]: now - MINUTE,
      [melbourneYear(now) + 1]: now - MINUTE,
    },
  });
}

const fixtures = (requests: SquiggleRequest[]) => requests.filter((r) => r.job === "fixture");

/** A finished Season: every Game complete, fetched in full well after the last one. */
function closedSeason(year: number, lastStart: number): SquiggleSyncSeason {
  const games = [
    game({ startTime: lastStart - 7 * DAY, complete: 100 }),
    game({ startTime: lastStart, complete: 100 }),
  ];
  return season(year, games, lastStart + GAME_LENGTH_ALLOWANCE_MS + HOUR);
}

describe("isInSeason", () => {
  const now = Date.parse("2027-03-01T00:00:00Z");

  it("is true once a Game has started and one isn't complete", () => {
    const s = season(
      2027,
      [game({ startTime: now - DAY, complete: 100 }), game({ startTime: now + DAY })],
      now,
    );
    expect(isInSeason(s, now)).toBe(true);
  });

  it("is true a week before the first Game", () => {
    expect(isInSeason(season(2027, [game({ startTime: now + 6 * DAY })], now), now)).toBe(true);
  });

  it("is false while the first Game is more than a week away", () => {
    expect(isInSeason(season(2027, [game({ startTime: now + 8 * DAY })], now), now)).toBe(false);
  });

  it("is false once every Game is complete", () => {
    const s = season(2027, [game({ startTime: now - DAY, complete: 100 })], now);
    expect(isInSeason(s, now)).toBe(false);
  });
});

describe("planSquiggleSync: the Fixture", () => {
  it("never refetches a Season that is over and was fetched after its last Game", () => {
    const lastStart = OFF_SEASON_NOW - 60 * DAY;
    const state = quietState(OFF_SEASON_NOW, [closedSeason(2026, lastStart)]);
    state.jobs.fixture = okJob(OFF_SEASON_NOW, 30 * DAY);
    state.emptyFixtureChecks = {};
    state.seasons.push(
      season(2027, [game({ startTime: Date.parse("2027-03-11T08:30:00Z") })], OFF_SEASON_NOW),
    );

    expect(fixtures(planSquiggleSync(state, OFF_SEASON_NOW))).toEqual([]);
  });

  it("fetches an over Season once more when it was last fetched before its final Game ended", () => {
    const lastStart = OFF_SEASON_NOW - 60 * DAY;
    const games = [game({ startTime: lastStart, complete: 100 })];
    const state = quietState(OFF_SEASON_NOW, [season(2026, games, lastStart + HOUR)]);
    state.emptyFixtureChecks = {};
    state.seasons.push(
      season(2027, [game({ startTime: Date.parse("2027-03-11T08:30:00Z") })], OFF_SEASON_NOW),
    );

    expect(fixtures(planSquiggleSync(state, OFF_SEASON_NOW))).toEqual([
      { job: "fixture", kind: "games", year: 2026 },
    ]);
  });

  it("fetches the incomplete Games hourly in-Season", () => {
    const games = [
      game({ startTime: GAME_DAY_NOW - 30 * DAY, complete: 100 }),
      game({ startTime: GAME_DAY_NOW + 2 * DAY }),
    ];
    const stale = season(2026, games, GAME_DAY_NOW - 3 * HOUR, GAME_DAY_NOW - 61 * MINUTE);
    const fresh = season(2026, games, GAME_DAY_NOW - 3 * HOUR, GAME_DAY_NOW - 59 * MINUTE);

    expect(planSquiggleSync(quietState(GAME_DAY_NOW, [stale]), GAME_DAY_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2026, complete: "!100" },
    ]);
    expect(planSquiggleSync(quietState(GAME_DAY_NOW, [fresh]), GAME_DAY_NOW)).toEqual([]);
  });

  it("reconciles the whole Season daily in-Season, instead of the hourly fetch", () => {
    const games = [
      game({ startTime: GAME_DAY_NOW - 30 * DAY, complete: 100 }),
      game({ startTime: GAME_DAY_NOW + 2 * DAY }),
    ];
    const s = season(2026, games, GAME_DAY_NOW - 25 * HOUR, GAME_DAY_NOW - 2 * HOUR);

    expect(planSquiggleSync(quietState(GAME_DAY_NOW, [s]), GAME_DAY_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2026 },
    ]);
  });

  it("fetches an off-Season Fixture daily, and not the incomplete Games hourly", () => {
    const games = [game({ startTime: Date.parse("2027-03-11T08:30:00Z") })];
    const due = season(2027, games, OFF_SEASON_NOW - 25 * HOUR, OFF_SEASON_NOW - 25 * HOUR);
    const notDue = season(2027, games, OFF_SEASON_NOW - 23 * HOUR, OFF_SEASON_NOW - 23 * HOUR);

    expect(planSquiggleSync(quietState(OFF_SEASON_NOW, [due]), OFF_SEASON_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2027 },
    ]);
    expect(planSquiggleSync(quietState(OFF_SEASON_NOW, [notDue]), OFF_SEASON_NOW)).toEqual([]);
  });

  it("asks daily for next year's Fixture until it has Games", () => {
    const lastStart = OFF_SEASON_NOW - 60 * DAY;
    // 2026 is over and 2027 has no Games yet. This year is 2026, so next year is 2027.
    const base = quietState(OFF_SEASON_NOW, [closedSeason(2026, lastStart)]);

    expect(planSquiggleSync(base, OFF_SEASON_NOW)).toEqual([]);

    const due = { ...base, emptyFixtureChecks: { 2027: OFF_SEASON_NOW - 25 * HOUR } };
    expect(planSquiggleSync(due, OFF_SEASON_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2027 },
    ]);

    const never = { ...base, emptyFixtureChecks: {} };
    expect(planSquiggleSync(never, OFF_SEASON_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2027 },
    ]);
  });

  it("makes the first-ever load: last, this and next year's Fixture, and teams", () => {
    const plan = planSquiggleSync(makeState({ knownTeamIds: [] }), OFF_SEASON_NOW);

    // FIRST_SEASON is 2026, so there is no 2025.
    expect(plan).toEqual([
      { job: "fixture", kind: "games", year: 2026 },
      { job: "fixture", kind: "games", year: 2027 },
      { job: "teams", kind: "teams" },
    ]);
  });

  it("includes last year on a first-ever load once there is a last year to fetch", () => {
    const now = Date.parse("2027-06-01T00:00:00Z");

    expect(
      fixtures(planSquiggleSync(makeState(), now)).map((r) => r.job === "fixture" && r.year),
    ).toEqual([2026, 2027, 2028]);
  });
});

describe("planSquiggleSync: Model tips", () => {
  it("asks hourly for each Round with a Game starting in the next 7 days", () => {
    const games = [
      game({ round: 9, startTime: GAME_DAY_NOW + 2 * HOUR }),
      game({ round: 10, startTime: GAME_DAY_NOW + 6 * DAY }),
      game({ round: 11, startTime: GAME_DAY_NOW + 8 * DAY }),
    ];
    const s = season(2026, games, GAME_DAY_NOW - 10 * MINUTE);
    const stale = quietState(GAME_DAY_NOW, [s]);
    stale.jobs["model-tips"] = okJob(GAME_DAY_NOW, 61 * MINUTE);
    const fresh = quietState(GAME_DAY_NOW, [s]);
    fresh.jobs["model-tips"] = okJob(GAME_DAY_NOW, 59 * MINUTE);

    expect(planSquiggleSync(stale, GAME_DAY_NOW)).toEqual([
      { job: "model-tips", kind: "tips", year: 2026, round: 9 },
      { job: "model-tips", kind: "tips", year: 2026, round: 10 },
    ]);
    expect(planSquiggleSync(fresh, GAME_DAY_NOW)).toEqual([]);
  });

  it("asks daily for the earliest Round with an unstarted Game otherwise", () => {
    const games = [
      game({ round: 2, startTime: OFF_SEASON_NOW + 120 * DAY }),
      game({ round: 1, startTime: OFF_SEASON_NOW + 110 * DAY }),
    ];
    const s = season(2027, games, OFF_SEASON_NOW - HOUR);
    const due = quietState(OFF_SEASON_NOW, [s]);
    due.jobs["model-tips"] = okJob(OFF_SEASON_NOW, 25 * HOUR);
    const notDue = quietState(OFF_SEASON_NOW, [s]);
    notDue.jobs["model-tips"] = okJob(OFF_SEASON_NOW, 5 * HOUR);

    expect(planSquiggleSync(due, OFF_SEASON_NOW)).toEqual([
      { job: "model-tips", kind: "tips", year: 2027, round: 1 },
    ]);
    expect(planSquiggleSync(notDue, OFF_SEASON_NOW)).toEqual([]);
  });

  it("asks for nothing when every Game has started", () => {
    const games = [game({ startTime: GAME_DAY_NOW - DAY, complete: 100 })];
    const state = quietState(GAME_DAY_NOW, [season(2026, games, GAME_DAY_NOW - HOUR)]);
    state.jobs["model-tips"] = idleJob();

    expect(planSquiggleSync(state, GAME_DAY_NOW).filter((r) => r.job === "model-tips")).toEqual([]);
  });
});

describe("planSquiggleSync: the Ladder", () => {
  const inSeasonGames = [
    game({ startTime: GAME_DAY_NOW - HOUR, complete: 100 }),
    game({ startTime: GAME_DAY_NOW + 2 * DAY }),
  ];
  const inSeason = season(2026, inSeasonGames, GAME_DAY_NOW - 2 * MINUTE);

  it("waits 10 minutes after a Game completes, then asks once", () => {
    const base = quietState(GAME_DAY_NOW, [inSeason]);
    base.jobs.ladder = okJob(GAME_DAY_NOW, HOUR);

    const tooSoon = {
      ...base,
      lastGameCompletion: { at: GAME_DAY_NOW - 9 * MINUTE, season: 2026 },
    };
    const due = { ...base, lastGameCompletion: { at: GAME_DAY_NOW - 11 * MINUTE, season: 2026 } };
    const done = {
      ...base,
      lastGameCompletion: { at: GAME_DAY_NOW - 11 * MINUTE, season: 2026 },
      jobs: { ...base.jobs, ladder: okJob(GAME_DAY_NOW, 5 * MINUTE) },
    };

    expect(planSquiggleSync(tooSoon, GAME_DAY_NOW)).toEqual([]);
    expect(planSquiggleSync(due, GAME_DAY_NOW)).toEqual([
      { job: "ladder", kind: "ladder", year: 2026 },
    ]);
    expect(planSquiggleSync(done, GAME_DAY_NOW)).toEqual([]);
  });

  it("reads the Ladder after the Season's last Game completes, though it is no longer in-Season", () => {
    const lastStart = OFF_SEASON_NOW - 60 * DAY;
    const state = quietState(OFF_SEASON_NOW, [closedSeason(2026, lastStart)]);
    state.emptyFixtureChecks = {};
    state.seasons.push(
      season(2027, [game({ startTime: OFF_SEASON_NOW + 100 * DAY })], OFF_SEASON_NOW),
    );
    state.jobs.ladder = okJob(OFF_SEASON_NOW, 61 * DAY);
    state.lastGameCompletion = { at: lastStart + 3 * HOUR, season: 2026 };

    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([
      { job: "ladder", kind: "ladder", year: 2026 },
    ]);
  });

  it("reconciles daily in-Season", () => {
    const due = quietState(GAME_DAY_NOW, [inSeason]);
    due.jobs.ladder = okJob(GAME_DAY_NOW, 25 * HOUR);
    const notDue = quietState(GAME_DAY_NOW, [inSeason]);
    notDue.jobs.ladder = okJob(GAME_DAY_NOW, 23 * HOUR);

    expect(planSquiggleSync(due, GAME_DAY_NOW)).toEqual([
      { job: "ladder", kind: "ladder", year: 2026 },
    ]);
    expect(planSquiggleSync(notDue, GAME_DAY_NOW)).toEqual([]);
  });

  it("does not reconcile off-Season", () => {
    const games = [game({ startTime: OFF_SEASON_NOW + 100 * DAY })];
    const state = quietState(OFF_SEASON_NOW, [season(2027, games, OFF_SEASON_NOW - HOUR)]);
    state.jobs.ladder = okJob(OFF_SEASON_NOW, 10 * DAY);

    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([]);
  });
});

describe("planSquiggleSync: Teams", () => {
  const games = [game({ startTime: OFF_SEASON_NOW + 100 * DAY, homeTeamId: 1, awayTeamId: 18 })];

  it("asks weekly", () => {
    const due = quietState(OFF_SEASON_NOW, [season(2027, games, OFF_SEASON_NOW - HOUR)]);
    due.knownTeamIds = [1, 18];
    due.jobs.teams = okJob(OFF_SEASON_NOW, 8 * DAY);
    const notDue = { ...due, jobs: { ...due.jobs, teams: okJob(OFF_SEASON_NOW, 3 * DAY) } };

    expect(planSquiggleSync(due, OFF_SEASON_NOW)).toEqual([{ job: "teams", kind: "teams" }]);
    expect(planSquiggleSync(notDue, OFF_SEASON_NOW)).toEqual([]);
  });

  it("asks at once when a Game names a team we don't have", () => {
    const state = quietState(OFF_SEASON_NOW, [season(2027, games, OFF_SEASON_NOW - HOUR)]);
    state.knownTeamIds = [1];
    state.jobs.teams = okJob(OFF_SEASON_NOW, 2 * DAY);

    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([{ job: "teams", kind: "teams" }]);
  });

  it("doesn't ask every minute for a team Squiggle never lists", () => {
    const state = quietState(OFF_SEASON_NOW, [season(2027, games, OFF_SEASON_NOW - HOUR)]);
    state.knownTeamIds = [1];
    state.jobs.teams = okJob(OFF_SEASON_NOW, 10 * MINUTE);

    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([]);
  });

  it("ignores a Game whose teams aren't named yet", () => {
    const unnamed = [
      game({ startTime: OFF_SEASON_NOW + 100 * DAY, homeTeamId: null, awayTeamId: null }),
    ];
    const state = quietState(OFF_SEASON_NOW, [season(2027, unnamed, OFF_SEASON_NOW - HOUR)]);
    state.jobs.teams = okJob(OFF_SEASON_NOW, 2 * DAY);

    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([]);
  });
});

describe("planSquiggleSync: backoff", () => {
  const now = OFF_SEASON_NOW;
  const emptyState = (teams: SquiggleJobState) => makeState({ jobs: { teams } });

  it.each([
    [1, 1],
    [2, 2],
    [3, 4],
    [4, 8],
    [5, 16],
    [6, 32],
    [7, 60],
    [12, 60],
  ])("after %i failures in a row, waits %i minutes", (failures, minutes) => {
    const failed = (ago: number) =>
      idleJob({ lastRunAt: now - ago, lastOkAt: null, consecutiveFailures: failures });
    const teams = (state: SquiggleSyncState) => state.jobs.teams;

    const waiting = emptyState(failed(minutes * MINUTE - 1));
    const ready = emptyState(failed(minutes * MINUTE));

    expect(teams(waiting).consecutiveFailures).toBe(failures);
    expect(planSquiggleSync(waiting, now).filter((r) => r.job === "teams")).toEqual([]);
    expect(planSquiggleSync(ready, now).filter((r) => r.job === "teams")).toEqual([
      { job: "teams", kind: "teams" },
    ]);
  });

  it("never waits longer than 60 minutes", () => {
    expect(BACKOFF_MAX_MS).toBe(HOUR);
  });

  it("holds back only the job that failed", () => {
    const state = makeState({
      jobs: { fixture: idleJob({ lastRunAt: now - MINUTE / 2, consecutiveFailures: 1 }) },
    });

    expect(planSquiggleSync(state, now)).toEqual([{ job: "teams", kind: "teams" }]);
  });
});

describe("planSquiggleSync: budgets", () => {
  it("plans nothing once 300 requests are recorded today", () => {
    expect(
      planSquiggleSync(makeState({ requestsToday: MAX_REQUESTS_PER_DAY }), OFF_SEASON_NOW),
    ).toEqual([]);
    expect(
      planSquiggleSync(makeState({ requestsToday: MAX_REQUESTS_PER_DAY - 1 }), OFF_SEASON_NOW),
    ).toHaveLength(1);
  });

  it("never plans more than what is left of the day", () => {
    const state = makeState({ requestsToday: MAX_REQUESTS_PER_DAY - 2 });

    // Fixtures for 2026 and 2027, then teams: the lowest priority drops.
    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2026 },
      { job: "fixture", kind: "games", year: 2027 },
    ]);
  });

  it("never plans more than the run's budget, and drops the lowest priority first", () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      game({ round: i + 1, startTime: GAME_DAY_NOW + (i + 1) * 12 * HOUR }),
    );
    const s = season(2026, games, GAME_DAY_NOW - 25 * HOUR);
    const state = makeState({ seasons: [s], emptyFixtureChecks: { 2027: GAME_DAY_NOW - HOUR } });
    state.lastGameCompletion = { at: GAME_DAY_NOW - HOUR, season: 2026 };

    const plan = planSquiggleSync(state, GAME_DAY_NOW);

    expect(plan).toHaveLength(MAX_REQUESTS_PER_RUN);
    expect(plan.map((r) => r.job)).toEqual([
      "fixture",
      "ladder",
      ...Array<string>(8).fill("model-tips"),
    ]);
    expect(plan.some((r) => r.job === "teams")).toBe(false);
  });
});

describe("planSquiggleSync: the New Year in Melbourne", () => {
  const lastStart = Date.parse("2026-09-26T09:30:00Z");
  const fixtureGames = [game({ startTime: Date.parse("2027-03-11T08:30:00Z") })];
  const stateAt = (now: number) => {
    const state = quietState(now, [
      closedSeason(2026, lastStart),
      season(2027, fixtureGames, now - HOUR),
    ]);
    state.emptyFixtureChecks = {};
    return state;
  };

  it("still counts as 2026 an hour before midnight in Melbourne, so next year's Fixture is known", () => {
    const before = Date.parse("2026-12-31T12:30:00Z");

    expect(melbourneYear(before)).toBe(2026);
    expect(planSquiggleSync(stateAt(before), before)).toEqual([]);
  });

  it("turns to 2027 at midnight in Melbourne, though it is still 31 December in UTC", () => {
    const after = Date.parse("2026-12-31T13:30:00Z");

    expect(melbourneYear(after)).toBe(2027);
    expect(planSquiggleSync(stateAt(after), after)).toEqual([
      { job: "fixture", kind: "games", year: 2028 },
    ]);
  });
});

describe("planSquiggleSync: situations", () => {
  it("makes only the daily requests in the real off-Season", () => {
    const lastStart = Date.parse("2026-09-26T09:30:00Z");
    const fixtureGames = [
      game({ round: 0, startTime: Date.parse("2027-03-11T08:30:00Z") }),
      game({ round: 1, startTime: Date.parse("2027-03-18T08:30:00Z") }),
    ];
    const state = makeState({
      seasons: [
        closedSeason(2026, lastStart),
        season(2027, fixtureGames, OFF_SEASON_NOW - 26 * HOUR),
      ],
      lastGameCompletion: { at: lastStart + 3 * HOUR, season: 2026 },
      jobs: {
        fixture: okJob(OFF_SEASON_NOW, 26 * HOUR),
        "model-tips": okJob(OFF_SEASON_NOW, 26 * HOUR),
        ladder: okJob(OFF_SEASON_NOW, 59 * DAY),
        teams: okJob(OFF_SEASON_NOW, 3 * DAY),
      },
    });

    // 2027 is next year: its Fixture is known, so one daily fetch covers it, and 2026 isn't asked.
    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2027 },
      { job: "model-tips", kind: "tips", year: 2027, round: 0 },
    ]);

    state.jobs.teams = okJob(OFF_SEASON_NOW, 8 * DAY);
    expect(planSquiggleSync(state, OFF_SEASON_NOW).at(-1)).toEqual({ job: "teams", kind: "teams" });
  });

  it("makes nothing when the off-Season requests were all made today", () => {
    const lastStart = Date.parse("2026-09-26T09:30:00Z");
    const fixtureGames = [game({ round: 0, startTime: Date.parse("2027-03-11T08:30:00Z") })];
    const state = makeState({
      seasons: [
        closedSeason(2026, lastStart),
        season(2027, fixtureGames, OFF_SEASON_NOW - 2 * HOUR),
      ],
      lastGameCompletion: { at: lastStart + 3 * HOUR, season: 2026 },
      jobs: {
        fixture: okJob(OFF_SEASON_NOW, 2 * HOUR),
        "model-tips": okJob(OFF_SEASON_NOW, 2 * HOUR),
        ladder: okJob(OFF_SEASON_NOW, 59 * DAY),
        teams: okJob(OFF_SEASON_NOW, 3 * DAY),
      },
    });

    expect(planSquiggleSync(state, OFF_SEASON_NOW)).toEqual([]);
  });

  it("refreshes the Fixture, Ladder and Model tips on a live Game day afternoon", () => {
    const games = [
      game({ round: 9, startTime: GAME_DAY_NOW - 30 * DAY, complete: 100 }),
      // Finished 20 minutes ago.
      game({ round: 10, startTime: GAME_DAY_NOW - 3 * HOUR - 20 * MINUTE, complete: 100 }),
      // Live now.
      game({ round: 10, startTime: GAME_DAY_NOW - HOUR, complete: 55 }),
      game({ round: 10, startTime: GAME_DAY_NOW + 4 * HOUR }),
      game({ round: 11, startTime: GAME_DAY_NOW + 6 * DAY }),
    ];
    const state = makeState({
      seasons: [season(2026, games, GAME_DAY_NOW - 20 * HOUR, GAME_DAY_NOW - 61 * MINUTE)],
      lastGameCompletion: { at: GAME_DAY_NOW - 20 * MINUTE, season: 2026 },
      emptyFixtureChecks: { 2027: GAME_DAY_NOW - HOUR },
      jobs: {
        fixture: okJob(GAME_DAY_NOW, 61 * MINUTE),
        "model-tips": okJob(GAME_DAY_NOW, 61 * MINUTE),
        ladder: okJob(GAME_DAY_NOW, 2 * HOUR),
        teams: okJob(GAME_DAY_NOW, 2 * DAY),
      },
    });

    expect(planSquiggleSync(state, GAME_DAY_NOW)).toEqual([
      { job: "fixture", kind: "games", year: 2026, complete: "!100" },
      { job: "ladder", kind: "ladder", year: 2026 },
      { job: "model-tips", kind: "tips", year: 2026, round: 10 },
      { job: "model-tips", kind: "tips", year: 2026, round: 11 },
    ]);
  });
});
