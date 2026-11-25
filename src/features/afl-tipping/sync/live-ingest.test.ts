import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  runLiveIngest,
  type LiveConnection,
  type LiveIngestDeps,
} from "~/features/afl-tipping/sync/live-ingest";
import type {
  LiveGamePatch,
  LiveGameState,
  LiveIngestStore,
  LiveRun,
} from "~/features/afl-tipping/sync/live-ingest.store";

const EMAIL = "tipper@example.test";

/** A stream the test feeds by hand. Ends when the test says so, or when `signal` aborts. */
function createStream(signal?: AbortSignal) {
  const queue: string[] = [];
  let wake: (() => void) | undefined;
  let ended = false;
  let error: Error | undefined;
  signal?.addEventListener("abort", () => end());
  function end() {
    ended = true;
    wake?.();
  }
  async function* chunks() {
    for (;;) {
      if (queue.length > 0) yield queue.shift()!;
      else if (error) throw error;
      else if (ended) return;
      else await new Promise<void>((resolve) => (wake = resolve));
    }
  }
  return {
    chunks: chunks(),
    push(text: string) {
      queue.push(text);
      wake?.();
    },
    end,
    fail(failure: Error) {
      error = failure;
      wake?.();
    },
  };
}

const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

function setup(options: { games?: LiveGameState[]; leaseHeld?: boolean; active?: boolean } = {}) {
  const games = new Map<number, LiveGameState>(
    (
      options.games ?? [{ id: 1, homeTeamId: 10, awayTeamId: 20, homeScore: null, awayScore: null }]
    ).map((game) => [game.id, game]),
  );
  const state = { active: options.active ?? true, leaseHeld: options.leaseHeld ?? false };
  const patches: { id: number; patch: LiveGamePatch }[] = [];
  const runs: LiveRun[] = [];
  const log: string[] = [];
  const store: LiveIngestStore = {
    acquireLease: async () => {
      log.push("acquire");
      return { ok: true, acquired: !state.leaseHeld };
    },
    releaseLease: async () => {
      log.push("release");
      return { ok: true };
    },
    hasLiveOrImminentGame: async () => ({ ok: true, active: state.active }),
    getGame: async (id) => ({ ok: true, game: games.get(id) ?? null }),
    updateGame: async (id, patch) => {
      patches.push({ id, patch });
      return { ok: true };
    },
    insertRun: async (run) => {
      log.push("run");
      runs.push(run);
      return { ok: true };
    },
  };
  const connectTimes: number[] = [];
  const streams: ReturnType<typeof createStream>[] = [];
  /** Answers connection N with `script[N]`, or a stream the test can feed. */
  const script: LiveConnection[] = [];
  const headersSeen: Record<string, string>[] = [];
  const connect: LiveIngestDeps["connect"] = async (_url, headers, signal) => {
    headersSeen.push(headers);
    const index = connectTimes.push(Date.now()) - 1;
    const scripted = script[index];
    if (scripted) return scripted;
    const stream = createStream(signal);
    streams.push(stream);
    return { ok: true, chunks: stream.chunks };
  };
  const controller = new AbortController();
  const start = (deadlineIn = 290_000, deps: Partial<LiveIngestDeps> = {}) =>
    runLiveIngest({
      signal: controller.signal,
      deadline: Date.now() + deadlineIn,
      deps: { store, connect, holder: "holder-1", contactEmail: EMAIL, ...deps },
    });
  return {
    store,
    state,
    patches,
    runs,
    log,
    connectTimes,
    streams,
    script,
    controller,
    start,
    headersSeen,
  };
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runLiveIngest: events to rows", () => {
  it("writes the live fields each event type carries, stamped with the time", async () => {
    const t = setup();
    const run = t.start();
    await tick();
    const stream = t.streams[0]!;

    stream.push(
      event("score", {
        gameid: 1,
        complete: 25,
        timestr: "Q1 5:00",
        score: { hscore: 12, ascore: 7 },
      }),
    );
    stream.push(event("timestr", { gameid: 1, timestr: "Q2 1:00" }));
    stream.push(event("complete", { gameid: 1, complete: 50 }));
    stream.push(event("winner", { gameid: 1, winnerteamid: 20 }));
    stream.push(
      event("game", {
        id: 1,
        hscore: 30,
        ascore: 40,
        timestr: "Q3",
        complete: 75,
        winnerteamid: null,
      }),
    );
    await tick();
    t.controller.abort();
    await run;

    const stamp = "2026-11-25T10:00:00.000Z";
    expect(t.patches.map((p) => p.patch)).toEqual([
      { home_score: 12, away_score: 7, time_str: "Q1 5:00", complete: 25, live_updated_at: stamp },
      { time_str: "Q2 1:00", live_updated_at: stamp },
      { complete: 50, live_updated_at: stamp },
      { winner_team_id: 20, live_updated_at: stamp },
      { home_score: 30, away_score: 40, time_str: "Q3", complete: 75, live_updated_at: stamp },
    ]);
  });

  it("ignores the welcome message and a Game we do not hold", async () => {
    const t = setup();
    const run = t.start();
    await tick();

    t.streams[0]!.push(event("message", "Hello and welcome"));
    t.streams[0]!.push(
      event("score", { gameid: 999, complete: 10, score: { hscore: 1, ascore: 1 } }),
    );
    await tick();
    t.controller.abort();
    await run;

    expect(t.patches).toEqual([]);
  });

  it.each([
    ["the Home team", 80, 70, 10],
    ["the Away team", 70, 80, 20],
    ["nobody in a Draw", 75, 75, null],
  ])("gives a Game that completes without a winner %s", async (_name, home, away, winner) => {
    const t = setup({
      games: [{ id: 1, homeTeamId: 10, awayTeamId: 20, homeScore: home, awayScore: away }],
    });
    const run = t.start();
    await tick();

    t.streams[0]!.push(event("complete", { gameid: 1, complete: 100 }));
    await tick();
    t.controller.abort();
    await run;

    expect(t.patches[0]!.patch).toMatchObject({ complete: 100, winner_team_id: winner });
  });

  it("uses the scores in the same update, and keeps a winner Squiggle sent", async () => {
    const t = setup();
    const run = t.start();
    await tick();

    t.streams[0]!.push(
      event("score", { gameid: 1, complete: 100, score: { hscore: 50, ascore: 60 } }),
    );
    t.streams[0]!.push(event("game", { id: 1, complete: 100, winnerteamid: 10 }));
    await tick();
    t.controller.abort();
    await run;

    expect(t.patches[0]!.patch.winner_team_id).toBe(20);
    expect(t.patches[1]!.patch.winner_team_id).toBe(10);
  });
});

describe("runLiveIngest: lease, run row and stopping", () => {
  it("opens no connection and records no run while the lease is held", async () => {
    const t = setup({ leaseHeld: true });

    const result = await t.start();

    expect(result).toEqual({ ok: true, connections: 0, stopped: "lease-held" });
    expect(t.connectTimes).toEqual([]);
    expect(t.runs).toEqual([]);
    expect(t.log).toEqual(["acquire"]);
  });

  it("sends no request without a contact email, and never takes the lease", async () => {
    const t = setup();

    const result = await t.start(290_000, { contactEmail: undefined });

    expect(result).toEqual({ ok: false, reason: "no-contact-email" });
    expect(t.connectTimes).toEqual([]);
    expect(t.log).toEqual([]);
  });

  it("sends the User-Agent with the email, and never records the email", async () => {
    const t = setup();
    const run = t.start();
    await tick();
    t.controller.abort();
    await run;

    expect(t.headersSeen[0]!["User-Agent"]).toContain(EMAIL);
    expect(JSON.stringify(t.runs)).not.toContain(EMAIL);
  });

  it("stops at the deadline, releases the lease and records one run", async () => {
    const t = setup();
    const run = t.start(290_000);
    await tick(289_999);
    expect(t.log).toEqual(["acquire"]);

    await tick(1);
    const result = await run;

    expect(result).toEqual({ ok: true, connections: 1, stopped: "deadline" });
    expect(t.log).toEqual(["acquire", "release", "run"]);
    expect(t.runs).toEqual([
      expect.objectContaining({ ok: true, reason: "deadline", requests: 1 }),
    ]);
  });

  it("stops when the caller aborts", async () => {
    const t = setup();
    const run = t.start();
    await tick(5_000);

    t.controller.abort();
    const result = await run;

    expect(result).toEqual({ ok: true, connections: 1, stopped: "aborted" });
    expect(t.log).toEqual(["acquire", "release", "run"]);
  });

  it("opens nothing when no Game is live or imminent", async () => {
    const t = setup({ active: false });

    const result = await t.start();

    expect(result).toEqual({ ok: true, connections: 0, stopped: "idle" });
    expect(t.connectTimes).toEqual([]);
    expect(t.log).toEqual(["acquire", "release", "run"]);
  });

  it("re-checks the window every minute and stops when the last Game is over", async () => {
    const t = setup();
    const run = t.start();
    await tick(59_000);
    t.state.active = false;
    expect(t.log).toEqual(["acquire"]);

    await tick(1_000);
    const result = await run;

    expect(result).toEqual({ ok: true, connections: 1, stopped: "idle" });
    expect(t.runs[0]).toMatchObject({ ok: true, reason: "idle", requests: 1 });
  });

  it("releases the lease and records the run even when the work throws", async () => {
    const t = setup();
    const run = t.start(290_000, {
      store: {
        ...t.store,
        hasLiveOrImminentGame: async () => {
          throw new Error("boom");
        },
      },
    });

    await expect(run).rejects.toThrow("boom");
    expect(t.log).toEqual(["acquire", "release", "run"]);
  });

  it("stops without retrying on a 403, and records the failure", async () => {
    const t = setup();
    t.script.push({ ok: false, reason: "http-403", retry: false });

    const result = await t.start();

    expect(result).toEqual({ ok: false, reason: "http-403" });
    expect(t.connectTimes).toHaveLength(1);
    expect(t.runs[0]).toMatchObject({ ok: false, reason: "http-403", requests: 1 });
    expect(t.log).toEqual(["acquire", "release", "run"]);
  });
});

describe("runLiveIngest: reconnecting", () => {
  it("reconnects after 2, 4, 8, 16 then 30 s, and counts each connection", async () => {
    const t = setup();
    for (let i = 0; i < 7; i++) t.script.push({ ok: false, reason: "http-503", retry: true });
    const run = t.start(290_000);

    await tick(2_000 + 4_000 + 8_000 + 16_000 + 30_000 + 30_000);
    t.controller.abort();
    const result = await run;

    const first = t.connectTimes[0]!;
    expect(t.connectTimes.map((at) => (at - first) / 1000)).toEqual([0, 2, 6, 14, 30, 60, 90]);
    expect(result).toEqual({ ok: false, reason: "connect-failed" });
    expect(t.runs[0]).toMatchObject({ ok: false, reason: "connect-failed", requests: 7 });
  });

  it("reconnects 2 s after a stream that delivered data drops", async () => {
    const t = setup();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const run = t.start();
    await tick();
    t.streams[0]!.push(event("timestr", { gameid: 1, timestr: "Q1" }));
    await tick();
    t.streams[0]!.fail(new Error("reset"));

    await tick(1_999);
    expect(t.connectTimes).toHaveLength(1);
    await tick(1);
    expect(t.connectTimes).toHaveLength(2);

    t.controller.abort();
    expect(await run).toEqual({ ok: true, connections: 2, stopped: "aborted" });
  });

  it("does not reconnect past the deadline", async () => {
    const t = setup();
    t.script.push({ ok: false, reason: "http-503", retry: true });
    const run = t.start(1_000);

    await tick(1_000);
    const result = await run;

    expect(t.connectTimes).toHaveLength(1);
    expect(result).toMatchObject({ ok: false });
  });
});
