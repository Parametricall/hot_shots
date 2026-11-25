import { describe, expect, it } from "vite-plus/test";
import {
  createFakeSupabase,
  filterArgs,
  type FakeCall,
  type FakeReply,
} from "~/features/afl-tipping/mocks/fake-supabase";
import {
  createAflGame,
  createAflStanding,
  createAflTeam,
} from "~/features/afl-tipping/mocks/factories";
import {
  createSquiggleSyncRepository,
  LIVE_DATA_PROTECTION_MS,
  melbourneMidnight,
} from "~/features/afl-tipping/sync/squiggle-sync.repository";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Wednesday 25 November 2026, 2pm in Melbourne (UTC+11). */
const NOW = Date.parse("2026-11-25T03:00:00Z");
const iso = (at: number) => new Date(at).toISOString();

type Rows = Partial<Record<string, unknown[] | ((call: FakeCall) => unknown[])>>;

/**
 * A fake client whose selects answer from `rows` (a table's rows, or a function of the query),
 * and whose queries fail with `errors["<table>:<op>"]`. It records every query.
 */
function fakeWith(rows: Rows = {}, errors: Record<string, string> = {}) {
  return createFakeSupabase((call): FakeReply => {
    const error = errors[`${call.table}:${call.op}`];
    if (error) return { error: { message: error } };
    if (call.op !== "select") return {};
    const reply = rows[call.table];
    return { data: typeof reply === "function" ? reply(call) : (reply ?? []) };
  });
}

const isTodayQuery = (call: FakeCall) => call.filters.some((filter) => filter.method === "gte");

function gameRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    season: 2026,
    round: 1,
    start_time: iso(NOW - 30 * 24 * HOUR),
    complete: 0,
    home_team_id: 1,
    away_team_id: 2,
    synced_at: iso(NOW - HOUR),
    squiggle_updated: null,
    live_updated_at: null,
    ...overrides,
  };
}

describe("melbourneMidnight", () => {
  it("is the start of the Melbourne day, in daylight saving time", () => {
    expect(melbourneMidnight(NOW)).toBe(Date.parse("2026-11-24T13:00:00Z"));
  });

  it("is the start of the Melbourne day, in standard time", () => {
    expect(melbourneMidnight(Date.parse("2026-06-10T00:00:00Z"))).toBe(
      Date.parse("2026-06-09T14:00:00Z"),
    );
  });

  it("is still the Melbourne day's start late in the evening there", () => {
    // 10:30pm Melbourne on the 24th.
    expect(melbourneMidnight(Date.parse("2026-11-24T11:30:00Z"))).toBe(
      Date.parse("2026-11-23T13:00:00Z"),
    );
  });
});

describe("loadState", () => {
  it("groups Games into Seasons, with newest and oldest synced_at", async () => {
    const { supabase } = fakeWith({
      afl_games: [
        gameRow({ id: 1, season: 2026, synced_at: iso(NOW - 5 * HOUR), complete: 100 }),
        gameRow({ id: 2, season: 2026, synced_at: iso(NOW - HOUR) }),
        gameRow({
          id: 3,
          season: 2027,
          round: 3,
          synced_at: iso(NOW - 2 * HOUR),
          home_team_id: null,
        }),
      ],
    });

    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);

    if (!result.ok) throw new Error(result.reason);
    expect(result.state.seasons).toEqual([
      {
        season: 2026,
        lastSyncedAt: NOW - HOUR,
        fullySyncedAt: NOW - 5 * HOUR,
        games: [
          expect.objectContaining({ id: 1, complete: 100, homeTeamId: 1, awayTeamId: 2 }),
          expect.objectContaining({ id: 2, complete: 0, startTime: NOW - 30 * 24 * HOUR }),
        ],
      },
      {
        season: 2027,
        lastSyncedAt: NOW - 2 * HOUR,
        fullySyncedAt: NOW - 2 * HOUR,
        games: [expect.objectContaining({ id: 3, round: 3, homeTeamId: null })],
      },
    ]);
  });

  it("reads Games a page at a time until a short page", async () => {
    const page = Array.from({ length: 1000 }, (_, i) => gameRow({ id: i + 1 }));
    const { supabase, calls } = fakeWith({
      afl_games: (call) => (filterArgs(call, "range")?.[0] === 0 ? page : [gameRow({ id: 1001 })]),
    });

    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);

    if (!result.ok) throw new Error(result.reason);
    expect(result.state.seasons[0]?.games).toHaveLength(1001);
    expect(calls.filter((call) => call.table === "afl_games")).toHaveLength(2);
  });

  it("takes the last Game completion from the newest complete Game, live time if newer", async () => {
    const { supabase } = fakeWith({
      afl_games: [
        gameRow({ id: 1, complete: 100, squiggle_updated: iso(NOW - 6 * HOUR) }),
        gameRow({
          id: 2,
          season: 2027,
          complete: 100,
          squiggle_updated: iso(NOW - 4 * HOUR),
          live_updated_at: iso(NOW - 3 * HOUR),
        }),
        gameRow({ id: 3, complete: 0, squiggle_updated: iso(NOW - MINUTE) }),
      ],
    });

    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);

    if (!result.ok) throw new Error(result.reason);
    expect(result.state.lastGameCompletion).toEqual({ at: NOW - 3 * HOUR, season: 2027 });
  });

  it("falls back to synced_at for a complete Game Squiggle gave no update time for", async () => {
    const { supabase } = fakeWith({
      afl_games: [gameRow({ complete: 100, synced_at: iso(NOW - 2 * HOUR) })],
    });
    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.lastGameCompletion).toEqual({ at: NOW - 2 * HOUR, season: 2026 });
  });

  it("never puts a Game completion in the future", async () => {
    const { supabase } = fakeWith({
      afl_games: [gameRow({ complete: 100, squiggle_updated: iso(NOW + 10 * HOUR) })],
    });
    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.lastGameCompletion).toEqual({ at: NOW, season: 2026 });
  });

  it("has no Game completion when no Game is complete", async () => {
    const { supabase } = fakeWith({ afl_games: [gameRow()] });
    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.lastGameCompletion).toBeNull();
  });

  it("derives each job's last run, last success and failures since", async () => {
    const run = (job: string, ago: number, ok: boolean) => ({
      job,
      started_at: iso(NOW - ago),
      ok,
    });
    const { supabase, calls } = fakeWith({
      // Newest first, as the query orders them.
      squiggle_sync_runs: (call) =>
        isTodayQuery(call)
          ? []
          : [
              run("fixture", 1 * HOUR, false),
              run("fixture", 2 * HOUR, false),
              run("fixture", 3 * HOUR, true),
              run("fixture", 4 * HOUR, false),
              run("ladder", 2 * HOUR, true),
            ],
    });

    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);

    if (!result.ok) throw new Error(result.reason);
    expect(result.state.jobs.fixture).toEqual({
      lastRunAt: NOW - HOUR,
      lastOkAt: NOW - 3 * HOUR,
      consecutiveFailures: 2,
    });
    expect(result.state.jobs.ladder).toEqual({
      lastRunAt: NOW - 2 * HOUR,
      lastOkAt: NOW - 2 * HOUR,
      consecutiveFailures: 0,
    });
    expect(result.state.jobs.teams).toEqual({
      lastRunAt: null,
      lastOkAt: null,
      consecutiveFailures: 0,
    });
    const recent = calls.find((call) => call.table === "squiggle_sync_runs" && !isTodayQuery(call));
    expect(filterArgs(recent!, "in")).toEqual([
      "job",
      ["fixture", "model-tips", "ladder", "teams"],
    ]);
    expect(filterArgs(recent!, "order")?.[0]).toBe("started_at");
  });

  it("counts a job that only ever failed as failing, with no last success", async () => {
    const { supabase } = fakeWith({
      squiggle_sync_runs: (call) =>
        isTodayQuery(call) ? [] : [{ job: "teams", started_at: iso(NOW - HOUR), ok: false }],
    });
    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.jobs.teams).toEqual({
      lastRunAt: NOW - HOUR,
      lastOkAt: null,
      consecutiveFailures: 1,
    });
  });

  it("sums the day's Standard API requests since Melbourne midnight, leaving out live runs", async () => {
    const { supabase, calls } = fakeWith({
      squiggle_sync_runs: (call) =>
        isTodayQuery(call) ? [{ requests: 3 }, { requests: 4 }, { requests: 1 }] : [],
    });

    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);

    if (!result.ok) throw new Error(result.reason);
    expect(result.state.requestsToday).toBe(8);
    const today = calls.find(isTodayQuery);
    expect(filterArgs(today!, "gte")).toEqual(["started_at", iso(melbourneMidnight(NOW))]);
    expect(filterArgs(today!, "neq")).toEqual(["job", "live"]);
  });

  it("reads the Teams we have, and the years whose Fixture had no Games", async () => {
    const { supabase, calls } = fakeWith({
      afl_teams: [{ id: 1 }, { id: 5 }],
      squiggle_fixture_checks: [{ season: 2028, checked_at: iso(NOW - HOUR) }],
    });

    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);

    if (!result.ok) throw new Error(result.reason);
    expect(result.state.knownTeamIds).toEqual([1, 5]);
    expect(result.state.emptyFixtureChecks).toEqual({ 2028: NOW - HOUR });
    const checks = calls.find((call) => call.table === "squiggle_fixture_checks");
    expect(filterArgs(checks!, "eq")).toEqual(["had_games", false]);
  });

  it("is not ok on a Supabase error", async () => {
    const { supabase } = fakeWith({}, { "afl_teams:select": "boom" });
    expect(await createSquiggleSyncRepository(supabase).loadState(NOW)).toEqual({
      ok: false,
      reason: "supabase-error",
      detail: "boom",
    });
  });

  it("is not ok on a malformed row", async () => {
    const { supabase } = fakeWith({ afl_games: [{ id: "x" }] });
    const result = await createSquiggleSyncRepository(supabase).loadState(NOW);
    expect(result).toMatchObject({ ok: false, reason: "bad-row" });
  });
});

describe("upsertTeams", () => {
  it("upserts every Team in one call, keyed on id", async () => {
    const { supabase, calls } = fakeWith();
    const teams = [createAflTeam({ id: 1 }), createAflTeam({ id: 2, name: "Suns", abbrev: "SUN" })];

    const result = await createSquiggleSyncRepository(supabase).upsertTeams(teams, NOW);

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "afl_teams",
      op: "upsert",
      options: { onConflict: "id" },
    });
    expect(calls[0]?.rows).toEqual([
      {
        id: 1,
        name: "Lions",
        abbrev: "LIO",
        logo: "/dummy-footy-logo.png",
        debut: 1897,
        synced_at: iso(NOW),
      },
      {
        id: 2,
        name: "Suns",
        abbrev: "SUN",
        logo: "/dummy-footy-logo.png",
        debut: 1897,
        synced_at: iso(NOW),
      },
    ]);
  });

  it("sends nothing for no Teams", async () => {
    const { supabase, calls } = fakeWith();
    expect(await createSquiggleSyncRepository(supabase).upsertTeams([], NOW)).toEqual({ ok: true });
    expect(calls).toHaveLength(0);
  });

  it("is not ok on a Supabase error", async () => {
    const { supabase } = fakeWith({}, { "afl_teams:upsert": "denied" });
    expect(
      await createSquiggleSyncRepository(supabase).upsertTeams([createAflTeam()], NOW),
    ).toEqual({ ok: false, reason: "supabase-error", detail: "denied" });
  });
});

describe("upsertGames", () => {
  const start = NOW + 2 * HOUR;
  const game = (overrides = {}) =>
    createAflGame({
      id: 10,
      season: 2026,
      round: 4,
      unixTime: start,
      date: new Date(start),
      homeScore: 80,
      awayScore: 70,
      winnerTeamId: 1,
      complete: 100,
      timeStr: "Full Time",
      updatedAt: NOW - HOUR,
      ...overrides,
    });

  it("maps a Game to its row, leaving live_updated_at alone", async () => {
    const { supabase, calls } = fakeWith();

    const result = await createSquiggleSyncRepository(supabase).upsertGames([game()], NOW);

    expect(result).toEqual({ ok: true });
    const upsert = calls.find((call) => call.op === "upsert");
    expect(upsert).toMatchObject({ table: "afl_games", options: { onConflict: "id" } });
    expect(upsert?.rows).toEqual([
      {
        id: 10,
        season: 2026,
        round: 4,
        round_name: "Round 1",
        venue_name: "Gabba",
        venue_city: "Brisbane",
        venue_state: "QLD",
        start_time: iso(start),
        home_team_id: 1,
        away_team_id: 2,
        home_score: 80,
        away_score: 70,
        winner_team_id: 1,
        complete: 100,
        time_str: "Full Time",
        is_finals: false,
        is_grand_final: false,
        squiggle_updated: iso(NOW - HOUR),
        synced_at: iso(NOW),
      },
    ]);
  });

  it("does not overwrite the live fields of a Game the live ingest wrote in the last 10 minutes", async () => {
    const { supabase, calls } = fakeWith({ afl_games: [{ id: 11 }] });
    const live = game({ id: 11, homeScore: 20, awayScore: 10, complete: 50, timeStr: "Q2 3:00" });
    const idle = game({ id: 12 });

    const result = await createSquiggleSyncRepository(supabase).upsertGames([live, idle], NOW);

    expect(result).toEqual({ ok: true });
    const lookup = calls.find((call) => call.op === "select");
    expect(filterArgs(lookup!, "in")).toEqual(["id", [11, 12]]);
    expect(filterArgs(lookup!, "gte")).toEqual([
      "live_updated_at",
      iso(NOW - LIVE_DATA_PROTECTION_MS),
    ]);

    const upserts = calls.filter((call) => call.op === "upsert");
    expect(upserts).toHaveLength(2);
    const [full, guarded] = upserts;
    expect(full?.rows).toEqual([
      expect.objectContaining({ id: 12, home_score: 80, complete: 100 }),
    ]);

    const [guardedRow] = (guarded?.rows ?? []) as Record<string, unknown>[];
    expect(guardedRow).toMatchObject({
      id: 11,
      round: 4,
      venue_name: "Gabba",
      synced_at: iso(NOW),
    });
    for (const column of [
      "home_score",
      "away_score",
      "time_str",
      "complete",
      "winner_team_id",
      "live_updated_at",
    ]) {
      expect(guardedRow).not.toHaveProperty(column);
    }
    // Columns left out must keep their stored value, not take a default or null.
    expect(guarded?.options).toMatchObject({ onConflict: "id", defaultToNull: false });
  });

  it("sends one upsert when no Game is live", async () => {
    const { supabase, calls } = fakeWith({ afl_games: [] });
    await createSquiggleSyncRepository(supabase).upsertGames([game()], NOW);
    expect(calls.filter((call) => call.op === "upsert")).toHaveLength(1);
  });

  it("sends nothing for no Games", async () => {
    const { supabase, calls } = fakeWith();
    await createSquiggleSyncRepository(supabase).upsertGames([], NOW);
    expect(calls).toHaveLength(0);
  });

  it("is not ok, and writes nothing, if the live lookup fails", async () => {
    const { supabase, calls } = fakeWith({}, { "afl_games:select": "boom" });
    const result = await createSquiggleSyncRepository(supabase).upsertGames([game()], NOW);
    expect(result).toEqual({ ok: false, reason: "supabase-error", detail: "boom" });
    expect(calls.some((call) => call.op === "upsert")).toBe(false);
  });
});

describe("upsertModelTips", () => {
  const tip = (gameId: number | null, overrides = {}) => ({
    gameId,
    round: 5,
    tipTeamId: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    confidence: 61.5,
    homeConfidence: 61.5,
    awayConfidence: 38.5,
    ...overrides,
  });

  it("upserts tips for Games we hold, skipping tips with no Game or an unknown one", async () => {
    const { supabase, calls } = fakeWith({ afl_games: [{ id: 10 }, { id: 11 }] });

    const result = await createSquiggleSyncRepository(supabase).upsertModelTips(
      2026,
      [tip(10), tip(11, { tipTeamId: null, confidence: null }), tip(null), tip(99)],
      NOW,
    );

    expect(result).toEqual({ ok: true });
    const upsert = calls.find((call) => call.op === "upsert");
    expect(upsert).toMatchObject({ table: "afl_model_tips", options: { onConflict: "game_id" } });
    expect(upsert?.rows).toEqual([
      {
        game_id: 10,
        season: 2026,
        round: 5,
        tip_team_id: 1,
        confidence: 61.5,
        home_confidence: 61.5,
        away_confidence: 38.5,
        synced_at: iso(NOW),
      },
      {
        game_id: 11,
        season: 2026,
        round: 5,
        tip_team_id: null,
        confidence: null,
        home_confidence: 61.5,
        away_confidence: 38.5,
        synced_at: iso(NOW),
      },
    ]);
  });

  it("keeps the last tip when a Game appears twice", async () => {
    const { supabase, calls } = fakeWith({ afl_games: [{ id: 10 }] });
    await createSquiggleSyncRepository(supabase).upsertModelTips(
      2026,
      [tip(10, { confidence: 50 }), tip(10, { confidence: 70 })],
      NOW,
    );
    expect(calls.find((call) => call.op === "upsert")?.rows).toEqual([
      expect.objectContaining({ game_id: 10, confidence: 70 }),
    ]);
  });

  it("sends nothing when no tip has a Game we hold", async () => {
    const { supabase, calls } = fakeWith({ afl_games: [] });
    const result = await createSquiggleSyncRepository(supabase).upsertModelTips(
      2026,
      [tip(10)],
      NOW,
    );
    expect(result).toEqual({ ok: true });
    expect(calls.some((call) => call.op === "upsert")).toBe(false);
  });
});

describe("upsertLadder", () => {
  it("upserts the Ladder for the Season, keyed on season and team", async () => {
    const { supabase, calls } = fakeWith();

    const result = await createSquiggleSyncRepository(supabase).upsertLadder(
      2026,
      [createAflStanding({ id: 3, rank: 2, points: 28, pointsFor: 700, pointsAgainst: 600 })],
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({
      table: "afl_ladder",
      op: "upsert",
      options: { onConflict: "season,team_id" },
    });
    expect(calls[0]?.rows).toEqual([
      {
        season: 2026,
        team_id: 3,
        name: "Lions",
        rank: 2,
        played: 10,
        wins: 7,
        losses: 2,
        draws: 1,
        points: 28,
        goals_for: 120,
        goals_against: 90,
        behinds_for: 80,
        behinds_against: 70,
        points_for: 700,
        points_against: 600,
        percentage: 131.1,
        synced_at: iso(NOW),
      },
    ]);
  });
});

describe("upsertFixtureCheck", () => {
  it("records when a year's Fixture was asked for and whether it had Games", async () => {
    const { supabase, calls } = fakeWith();

    const result = await createSquiggleSyncRepository(supabase).upsertFixtureCheck(
      2028,
      false,
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({
      table: "squiggle_fixture_checks",
      op: "upsert",
      options: { onConflict: "season" },
      rows: { season: 2028, checked_at: iso(NOW), had_games: false },
    });
  });
});

describe("insertRun", () => {
  it("inserts a run row, with null for a missing reason and detail", async () => {
    const { supabase, calls } = fakeWith();

    const result = await createSquiggleSyncRepository(supabase).insertRun({
      job: "ladder",
      startedAt: NOW,
      finishedAt: NOW + 2_000,
      ok: true,
      requests: 1,
    });

    expect(result).toEqual({ ok: true });
    expect(calls[0]).toMatchObject({
      table: "squiggle_sync_runs",
      op: "insert",
      rows: {
        job: "ladder",
        started_at: iso(NOW),
        finished_at: iso(NOW + 2_000),
        ok: true,
        reason: null,
        detail: null,
        requests: 1,
      },
    });
  });

  it("is not ok on a Supabase error", async () => {
    const { supabase } = fakeWith({}, { "squiggle_sync_runs:insert": "nope" });
    const result = await createSquiggleSyncRepository(supabase).insertRun({
      job: "teams",
      startedAt: NOW,
      finishedAt: NOW,
      ok: false,
      reason: "http-500",
      requests: 1,
    });
    expect(result).toEqual({ ok: false, reason: "supabase-error", detail: "nope" });
  });
});
