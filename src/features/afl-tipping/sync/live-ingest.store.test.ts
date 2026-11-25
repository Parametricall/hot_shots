import { describe, expect, it } from "vite-plus/test";
import { createFakeSupabase, filterArgs } from "~/features/afl-tipping/mocks/fake-supabase";
import { createLiveIngestStore } from "~/features/afl-tipping/sync/live-ingest.store";

describe("createLiveIngestStore", () => {
  it("takes and gives up the lease through its functions", async () => {
    const { supabase, calls } = createFakeSupabase((call) =>
      call.table === "acquire_squiggle_live_lease" ? { data: true } : undefined,
    );
    const store = createLiveIngestStore(supabase);

    expect(await store.acquireLease("h", 295)).toEqual({ ok: true, acquired: true });
    expect(await store.releaseLease("h")).toEqual({ ok: true });
    expect(calls.map((call) => [call.table, call.rows])).toEqual([
      ["acquire_squiggle_live_lease", { holder: "h", seconds: 295 }],
      ["release_squiggle_live_lease", { holder: "h" }],
    ]);
  });

  it("asks for an unfinished Game that started in the window", async () => {
    const { supabase, calls } = createFakeSupabase(() => ({ data: [{ id: 1 }] }));
    const now = Date.parse("2026-11-25T10:00:00Z");

    const result = await createLiveIngestStore(supabase).hasLiveOrImminentGame(now);

    expect(result).toEqual({ ok: true, active: true });
    expect(filterArgs(calls[0]!, "lt")).toEqual(["complete", 100]);
    expect(filterArgs(calls[0]!, "gte")).toEqual(["start_time", "2026-11-25T04:00:00.000Z"]);
    expect(filterArgs(calls[0]!, "lte")).toEqual(["start_time", "2026-11-25T10:30:00.000Z"]);
  });

  it("reads one Game, writes a patch by id, and records a live run", async () => {
    const { supabase, calls } = createFakeSupabase((call) =>
      call.op === "select"
        ? {
            data: [{ id: 7, home_team_id: 1, away_team_id: 2, home_score: 10, away_score: 9 }],
          }
        : undefined,
    );
    const store = createLiveIngestStore(supabase);

    expect(await store.getGame(7)).toEqual({
      ok: true,
      game: { id: 7, homeTeamId: 1, awayTeamId: 2, homeScore: 10, awayScore: 9 },
    });
    await store.updateGame(7, { complete: 50, live_updated_at: "t" });
    await store.insertRun({ startedAt: 0, finishedAt: 1000, ok: true, requests: 2 });

    expect(calls[1]).toMatchObject({ op: "update", rows: { complete: 50, live_updated_at: "t" } });
    expect(filterArgs(calls[1]!, "eq")).toEqual(["id", 7]);
    expect(calls[2]).toMatchObject({
      table: "squiggle_sync_runs",
      op: "insert",
      rows: { job: "live", ok: true, requests: 2 },
    });
  });

  it("reports a Supabase error instead of throwing", async () => {
    const { supabase } = createFakeSupabase(() => ({ error: { message: "down" } }));
    expect(await createLiveIngestStore(supabase).getGame(1)).toEqual({
      ok: false,
      reason: "supabase-error",
      detail: "down",
    });
  });
});
