import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { SquiggleClient } from "~/features/afl-tipping/api/squiggle/api";
import {
  createAflGame,
  createAflStanding,
  createAflTeam,
} from "~/features/afl-tipping/mocks/factories";
import {
  createFakeSupabase,
  filterArgs,
  type FakeCall,
  type FakeReply,
} from "~/features/afl-tipping/mocks/fake-supabase";
import type { SquiggleRequest } from "~/features/afl-tipping/sync/plan-squiggle-sync";

vi.mock("~/features/afl-tipping/sync/plan-squiggle-sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/features/afl-tipping/sync/plan-squiggle-sync")>()),
  planSquiggleSync: vi.fn(),
}));

import { planSquiggleSync } from "~/features/afl-tipping/sync/plan-squiggle-sync";
import { runSquiggleSync } from "~/features/afl-tipping/sync/run-squiggle-sync";

const NOW = Date.parse("2026-11-25T03:00:00Z");
const iso = (at: number) => new Date(at).toISOString();

/** What the real client reports when it sent nothing. */
const NOT_SENT = ["budget", "no-contact-email"];

function counted<A extends unknown[], R extends { ok: boolean }>(
  fn: (...args: A) => Promise<R>,
  count: () => void,
) {
  return async (...args: A): Promise<R> => {
    const result = await fn(...args);
    // Like the real client, a failed request still counts as sent.
    if (!("reason" in result) || !NOT_SENT.includes(String(result.reason))) count();
    return result;
  };
}

/**
 * A client whose fetchers succeed with fixed answers unless overridden. It counts requests as the
 * real one does, so `requestCount` is what a run reads to record each job's `requests`.
 */
function fakeClient(overrides: Partial<Omit<SquiggleClient, "requestCount">> = {}): SquiggleClient {
  let requests = 0;
  const count = () => {
    requests += 1;
  };
  const methods = {
    fetchGames: () =>
      Promise.resolve({
        ok: true as const,
        games: [createAflGame({ id: 10, season: 2027, round: 1 })],
      }),
    fetchGame: () => Promise.resolve({ ok: true as const, games: [] }),
    fetchModelTips: () =>
      Promise.resolve({
        ok: true as const,
        tips: [
          {
            gameId: 10,
            round: 1,
            tipTeamId: 1,
            homeTeamId: 1,
            awayTeamId: 2,
            confidence: 60,
            homeConfidence: 60,
            awayConfidence: 40,
          },
        ],
      }),
    fetchLadder: () =>
      Promise.resolve({ ok: true as const, ladder: [createAflStanding({ id: 1 })] }),
    fetchTeams: () => Promise.resolve({ ok: true as const, teams: [createAflTeam({ id: 1 })] }),
    ...overrides,
  };
  return {
    fetchGames: counted(methods.fetchGames, count),
    fetchGame: counted(methods.fetchGame, count),
    fetchModelTips: counted(methods.fetchModelTips, count),
    fetchLadder: counted(methods.fetchLadder, count),
    fetchTeams: counted(methods.fetchTeams, count),
    requestCount: () => requests,
  };
}

/**
 * An empty database, with every write accepted unless `errors["<table>:<op>"]` says otherwise.
 * `liveGameIds` are the Games the live ingest wrote in the last 10 minutes.
 */
function fakeDatabase(errors: Record<string, string> = {}, liveGameIds: number[] = []) {
  return createFakeSupabase((call: FakeCall): FakeReply => {
    const error = errors[`${call.table}:${call.op}`];
    if (error) return { error: { message: error } };
    if (call.op !== "select") return {};
    if (call.table !== "afl_games") return { data: [] };
    // The live-fields guard filters on live_updated_at; the model tips' Game lookup only on id.
    if (filterArgs(call, "gte")) return { data: liveGameIds.map((id) => ({ id })) };
    return { data: filterArgs(call, "in") ? [{ id: 10 }] : [] };
  });
}

const writes = (calls: FakeCall[], table: string) =>
  calls.filter((call) => call.table === table && call.op !== "select");

const runRows = (calls: FakeCall[]) =>
  writes(calls, "squiggle_sync_runs").map((call) => call.rows as Record<string, unknown>);

beforeEach(() => {
  vi.mocked(planSquiggleSync).mockReset();
});

describe("runSquiggleSync", () => {
  it("does nothing, and records no run, when nothing is planned", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([]);
    const { supabase, calls } = fakeDatabase();

    const result = await runSquiggleSync({ supabase, now: NOW, client: fakeClient() });

    expect(result).toEqual({ ok: true, requests: 0, jobs: [] });
    expect(calls.filter((call) => call.op !== "select")).toEqual([]);
  });

  it("plans from the state it loaded, at the time it was given", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([]);
    const { supabase } = fakeDatabase();

    await runSquiggleSync({ supabase, now: NOW, client: fakeClient() });

    expect(planSquiggleSync).toHaveBeenCalledWith(
      expect.objectContaining({ seasons: [], requestsToday: 0 }),
      NOW,
    );
  });

  it("sends each kind of request to its fetcher and stores the answer", async () => {
    const requests: SquiggleRequest[] = [
      { job: "fixture", kind: "games", year: 2027, complete: "!100" },
      { job: "ladder", kind: "ladder", year: 2026 },
      { job: "model-tips", kind: "tips", year: 2027, round: 1 },
      { job: "teams", kind: "teams" },
    ];
    vi.mocked(planSquiggleSync).mockReturnValue(requests);
    const client = fakeClient();
    const fetchGames = vi.spyOn(client, "fetchGames");
    const fetchLadder = vi.spyOn(client, "fetchLadder");
    const fetchModelTips = vi.spyOn(client, "fetchModelTips");
    const fetchTeams = vi.spyOn(client, "fetchTeams");
    const { supabase, calls } = fakeDatabase();

    const result = await runSquiggleSync({ supabase, now: NOW, client });

    expect(fetchGames).toHaveBeenCalledWith({ year: 2027, complete: "!100" });
    expect(fetchLadder).toHaveBeenCalledWith(2026);
    expect(fetchModelTips).toHaveBeenCalledWith({ year: 2027, round: 1 });
    expect(fetchTeams).toHaveBeenCalledOnce();
    expect(writes(calls, "afl_games").map((call) => call.op)).toEqual(["upsert"]);
    expect(writes(calls, "afl_ladder")[0]?.rows).toEqual([
      expect.objectContaining({ season: 2026, team_id: 1 }),
    ]);
    expect(writes(calls, "afl_model_tips")[0]?.rows).toEqual([
      expect.objectContaining({ game_id: 10, season: 2027 }),
    ]);
    expect(writes(calls, "afl_teams")[0]?.rows).toEqual([expect.objectContaining({ id: 1 })]);
    expect(result).toEqual({
      ok: true,
      requests: 4,
      jobs: [
        { job: "fixture", ok: true, requests: 1 },
        { job: "ladder", ok: true, requests: 1 },
        { job: "model-tips", ok: true, requests: 1 },
        { job: "teams", ok: true, requests: 1 },
      ],
    });
  });

  it("asks for a request's Game by year only when it is a full fetch", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([{ job: "fixture", kind: "games", year: 2027 }]);
    const client = fakeClient();
    const fetchGames = vi.spyOn(client, "fetchGames");
    const { supabase } = fakeDatabase();

    await runSquiggleSync({ supabase, now: NOW, client });

    expect(fetchGames).toHaveBeenCalledWith({ year: 2027 });
  });

  it("records one run row per job, however many requests the job made", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([
      { job: "fixture", kind: "games", year: 2026 },
      { job: "fixture", kind: "games", year: 2027 },
      { job: "teams", kind: "teams" },
    ]);
    const { supabase, calls } = fakeDatabase();

    await runSquiggleSync({ supabase, now: NOW, client: fakeClient() });

    expect(runRows(calls)).toEqual([
      expect.objectContaining({
        job: "fixture",
        started_at: iso(NOW),
        ok: true,
        reason: null,
        requests: 2,
      }),
      expect.objectContaining({ job: "teams", ok: true, requests: 1 }),
    ]);
  });

  it("records a full Fixture fetch in squiggle_fixture_checks, with whether it had Games", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([
      { job: "fixture", kind: "games", year: 2027 },
      { job: "fixture", kind: "games", year: 2028 },
    ]);
    const client = fakeClient({
      fetchGames: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, games: [createAflGame({ id: 10, season: 2027 })] })
        .mockResolvedValueOnce({ ok: true, games: [] }),
    });
    const { supabase, calls } = fakeDatabase();

    await runSquiggleSync({ supabase, now: NOW, client });

    expect(writes(calls, "squiggle_fixture_checks").map((call) => call.rows)).toEqual([
      { season: 2027, checked_at: iso(NOW), had_games: true },
      { season: 2028, checked_at: iso(NOW), had_games: false },
    ]);
  });

  it("leaves squiggle_fixture_checks alone after an incomplete-Games fetch", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([
      { job: "fixture", kind: "games", year: 2027, complete: "!100" },
    ]);
    const { supabase, calls } = fakeDatabase();

    await runSquiggleSync({ supabase, now: NOW, client: fakeClient() });

    expect(writes(calls, "squiggle_fixture_checks")).toEqual([]);
  });

  describe("when a request fails", () => {
    it("writes nothing for that job, records it as failed, and still runs the other jobs", async () => {
      vi.mocked(planSquiggleSync).mockReturnValue([
        { job: "ladder", kind: "ladder", year: 2026 },
        { job: "teams", kind: "teams" },
      ]);
      const client = fakeClient({
        fetchLadder: () => Promise.resolve({ ok: false, reason: "http-503", detail: "busy" }),
      });
      const { supabase, calls } = fakeDatabase();

      const result = await runSquiggleSync({ supabase, now: NOW, client });

      expect(writes(calls, "afl_ladder")).toEqual([]);
      expect(writes(calls, "afl_teams")).toHaveLength(1);
      expect(runRows(calls)).toEqual([
        expect.objectContaining({
          job: "ladder",
          ok: false,
          reason: "http-503",
          detail: "busy",
          requests: 1,
        }),
        expect.objectContaining({ job: "teams", ok: true, requests: 1 }),
      ]);
      expect(result).toEqual({
        ok: true,
        requests: 2,
        jobs: [
          { job: "ladder", ok: false, requests: 1, reason: "http-503", detail: "busy" },
          { job: "teams", ok: true, requests: 1 },
        ],
      });
    });

    it("records no run for a job whose requests were never sent (budget spent)", async () => {
      vi.mocked(planSquiggleSync).mockReturnValue([{ job: "ladder", kind: "ladder", year: 2026 }]);
      const client = fakeClient({
        fetchLadder: () => Promise.resolve({ ok: false, reason: "budget" }),
      });
      const { supabase, calls } = fakeDatabase();

      const result = await runSquiggleSync({ supabase, now: NOW, client });

      expect(runRows(calls)).toEqual([]);
      expect(result).toEqual({ ok: true, requests: 0, jobs: [] });
    });

    it("stops, and records nothing, without a contact email", async () => {
      vi.mocked(planSquiggleSync).mockReturnValue([
        { job: "ladder", kind: "ladder", year: 2026 },
        { job: "teams", kind: "teams" },
      ]);
      const fetchTeams = vi.fn();
      const client = fakeClient({
        fetchLadder: () => Promise.resolve({ ok: false, reason: "no-contact-email" }),
        fetchTeams,
      });
      const { supabase, calls } = fakeDatabase();

      const result = await runSquiggleSync({ supabase, now: NOW, client });

      expect(result).toEqual({ ok: false, reason: "no-contact-email" });
      expect(fetchTeams).not.toHaveBeenCalled();
      expect(calls.filter((call) => call.op !== "select")).toEqual([]);
    });

    it("records the job as failed when storing the answer fails", async () => {
      vi.mocked(planSquiggleSync).mockReturnValue([{ job: "teams", kind: "teams" }]);
      const { supabase, calls } = fakeDatabase({ "afl_teams:upsert": "disk full" });

      const result = await runSquiggleSync({ supabase, now: NOW, client: fakeClient() });

      expect(runRows(calls)).toEqual([
        expect.objectContaining({
          job: "teams",
          ok: false,
          reason: "supabase-error",
          detail: "disk full",
          requests: 1,
        }),
      ]);
      expect(result).toMatchObject({ ok: true, jobs: [{ job: "teams", ok: false }] });
    });
  });

  it("is not ok, and sends nothing to Squiggle, if the state can't be loaded", async () => {
    const client = fakeClient();
    const fetchGames = vi.spyOn(client, "fetchGames");
    const { supabase } = fakeDatabase({ "afl_teams:select": "down" });

    const result = await runSquiggleSync({ supabase, now: NOW, client });

    expect(result).toEqual({ ok: false, reason: "supabase-error", detail: "down" });
    expect(fetchGames).not.toHaveBeenCalled();
    expect(planSquiggleSync).not.toHaveBeenCalled();
  });

  it("keeps the live fields of a Game the live ingest wrote in the last 10 minutes", async () => {
    vi.mocked(planSquiggleSync).mockReturnValue([{ job: "fixture", kind: "games", year: 2027 }]);
    const { supabase, calls } = fakeDatabase({}, [10]);

    await runSquiggleSync({
      supabase,
      now: NOW,
      client: fakeClient({
        fetchGames: () =>
          Promise.resolve({
            ok: true,
            games: [createAflGame({ id: 10, season: 2027, homeScore: 0, complete: 0 })],
          }),
      }),
    });

    const [gameUpsert] = writes(calls, "afl_games");
    const [row] = (gameUpsert?.rows ?? []) as Record<string, unknown>[];
    expect(row).toMatchObject({ id: 10, season: 2027 });
    expect(row).not.toHaveProperty("home_score");
    expect(row).not.toHaveProperty("complete");
    expect(gameUpsert?.options).toMatchObject({ defaultToNull: false });
  });
});
