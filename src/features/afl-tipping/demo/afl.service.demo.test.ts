import { describe, it, expect, beforeEach } from "vite-plus/test";
import { TIP_REJECTION_MESSAGES } from "~/features/afl-tipping/api/competition";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import { createAflGame, createAflTeam } from "~/features/afl-tipping/mocks/factories";
import type { AflModelTip } from "~/features/afl-tipping/types";
import { createAflServiceDemo } from "./afl.service.demo";
import { createSquiggleServiceDemo } from "./squiggle.service.demo";
import type { LoadedSnapshot } from "./snapshot";
import { createVisitorStore } from "./visitor-store";

const T0 = new Date("2026-06-04T09:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;
const LONG_AGO = T0 - 1000 * HOUR;

// Round 1: games 1 and 2, three hours apart. Round 2: game 3, a week later.
function game(id: number, round: number, unixTime: number, homeWins: boolean) {
  const homeTeamId = id * 10;
  const awayTeamId = id * 10 + 1;
  return createAflGame({
    id,
    round,
    unixTime,
    date: new Date(unixTime),
    homeTeamId,
    awayTeamId,
    homeScore: homeWins ? 100 : 70,
    awayScore: homeWins ? 70 : 100,
    winnerTeamId: homeWins ? homeTeamId : awayTeamId,
    complete: 100,
    timeStr: "Full Time",
  });
}

const games = [
  game(1, 1, T0, true),
  game(2, 1, T0 + 3 * HOUR, false),
  game(3, 2, T0 + 7 * 24 * HOUR, true),
];

function modelTip(gameId: number, round: number, tipTeamId: number): AflModelTip {
  return {
    gameId,
    round,
    tipTeamId,
    homeTeamId: gameId * 10,
    awayTeamId: gameId * 10 + 1,
    confidence: 60,
    homeConfidence: 60,
    awayConfidence: 40,
  };
}

function row(gameId: number, userId: string, tip: number): AllTipsRow {
  return {
    game_id: gameId,
    user_id: userId,
    tip,
    margin: gameId === 1 ? 20 : null,
    is_underdog: false,
    created_at: new Date(T0 - 5 * HOUR).toISOString(),
  };
}

const snapshot: LoadedSnapshot = {
  season: 2026,
  capturedAt: "2026-10-17T00:00:00.000Z",
  teams: [createAflTeam({ id: 10, name: "Home One" })],
  games,
  // The Model tips the home team in games 1 and 3, the away team in game 2.
  modelTips: [modelTip(1, 1, 10), modelTip(2, 1, 21), modelTip(3, 2, 30)],
  standingsAfterRound: new Map(),
  tipsters: [{ userId: "tipster-a", displayName: "Tipster A", joinedAt: LONG_AGO }],
  tips: [row(1, "tipster-a", 10), row(2, "tipster-a", 21), row(3, "tipster-a", 30)],
};

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

let clock: number;
let service: ReturnType<typeof createAflServiceDemo>;

beforeEach(() => {
  clock = T0 - HOUR; // just before game 1
  const storage = memoryStorage();
  service = createAflServiceDemo({
    loadSnapshot: async () => ({ ok: true, snapshot }),
    now: () => clock,
    store: createVisitorStore(() => storage, 2026),
  });
});

describe("aflServiceDemo submitTip and getTips", () => {
  it("saves a Tip with its Underdog status and returns it from getTips", async () => {
    await service.submitTip({ data: { gameId: 1, teamId: 11, margin: 15 } });
    const tips = await service.getTips({ data: { gameIds: [1, 2] } });
    expect(tips).toEqual([{ gameId: 1, tipTeamId: 11, margin: 15, isUnderdog: true }]);
  });

  it("rejects a Tip after Lockout with the server functions' message", async () => {
    clock = T0 + 1;
    await expect(service.submitTip({ data: { gameId: 1, teamId: 10 } })).rejects.toThrow(
      TIP_REJECTION_MESSAGES["game-started"],
    );
  });

  it("rejects a Tip on an unknown Game", async () => {
    await expect(service.submitTip({ data: { gameId: 99, teamId: 10 } })).rejects.toThrow(
      TIP_REJECTION_MESSAGES["game-not-found"],
    );
  });

  it("unlocks the Tip again when the clock moves back before the Game", async () => {
    await service.submitTip({ data: { gameId: 1, teamId: 10 } });

    clock = T0 + HOUR; // past game 1: locked, Tip stays
    await expect(service.submitTip({ data: { gameId: 1, teamId: 11 } })).rejects.toThrow();
    expect(await service.getTips({ data: { gameIds: [1] } })).toMatchObject([{ tipTeamId: 10 }]);

    clock = T0 - HOUR; // back before game 1: tippable again
    await service.submitTip({ data: { gameId: 1, teamId: 11 } });
    expect(await service.getTips({ data: { gameIds: [1] } })).toMatchObject([{ tipTeamId: 11 }]);
  });

  it("gives an Auto-tip for a skipped Game, which goes once the Game is tipped earlier", async () => {
    clock = T0 + HOUR; // past game 1, never tipped
    expect(await service.getTips({ data: { gameIds: [1] } })).toEqual([
      { gameId: 1, tipTeamId: 10, isAutoTip: true },
    ]);

    clock = T0 - HOUR; // back before game 1
    expect(await service.getTips({ data: { gameIds: [1] } })).toEqual([]);
    await service.submitTip({ data: { gameId: 1, teamId: 11 } });

    clock = T0 + HOUR; // forward again: the Tip stands and there is no Auto-tip
    expect(await service.getTips({ data: { gameIds: [1] } })).toMatchObject([
      { gameId: 1, tipTeamId: 11 },
    ]);
  });
});

describe("aflServiceDemo Leaderboard and stats", () => {
  it("includes You, with no Score before any Game is played", async () => {
    const board = await service.getLeaderboard();
    expect(board.map((e) => e.displayName).sort()).toEqual(["Tipster A", "You"]);
    expect(board.every((e) => e.score === 0)).toBe(true);
  });

  it("scores You and the made-up Tipsters from the Games played so far", async () => {
    await service.submitTip({ data: { gameId: 1, teamId: 10 } });
    clock = T0 + HOUR; // game 1 done: home won
    const board = await service.getLeaderboard();
    expect(board.find((e) => e.displayName === "You")?.score).toBe(1);
    expect(board.find((e) => e.displayName === "Tipster A")?.score).toBe(1);
  });

  it("scores a skipped Game as an Auto-tip for You", async () => {
    clock = T0 + 4 * HOUR; // games 1 and 2 done; home won game 1, away won game 2
    const board = await service.getLeaderboard();
    expect(board.find((e) => e.displayName === "You")?.score).toBe(1);
  });

  it("includes You in the player stats", async () => {
    const stats = await service.getPlayerStats();
    expect(stats.map((e) => e.displayName).sort()).toEqual(["Tipster A", "You"]);
  });
});

describe("aflServiceDemo getGroupTips", () => {
  it("hides the made-up Tipsters' teams before Lockout and shows them after", async () => {
    const before = await service.getGroupTips({ data: { round: 1 } });
    const hidden = before.filter((e) => e.userId === "tipster-a" && e.hasTipped);
    expect(hidden).toHaveLength(2);
    expect(hidden.every((e) => e.tipTeamId === null)).toBe(true);

    clock = T0 + 1; // game 1 has started, game 2 has not
    const after = await service.getGroupTips({ data: { round: 1 } });
    const revealed = after.filter((e) => e.userId === "tipster-a");
    expect(revealed.find((e) => e.gameId === 1)?.tipTeamId).toBe(10);
    expect(revealed.find((e) => e.gameId === 2)?.tipTeamId).toBeNull();
  });

  it("has no Tips yet for Rounds after the current one", async () => {
    const future = await service.getGroupTips({ data: { round: 2 } });
    expect(future.filter((e) => e.hasTipped)).toEqual([]);
  });

  it("shows the visitor's own Tip as tipped", async () => {
    await service.submitTip({ data: { gameId: 2, teamId: 20 } });
    const entries = await service.getGroupTips({ data: { round: 1 } });
    expect(entries.find((e) => e.userId === "demo-visitor" && e.gameId === 2)?.hasTipped).toBe(
      true,
    );
  });
});

describe("aflServiceDemo with a snapshot that fails to load", () => {
  it("throws, so the route's error boundary shows it", async () => {
    const storage = memoryStorage();
    const broken = createAflServiceDemo({
      loadSnapshot: async () => ({ ok: false, reason: "parse-failed", detail: "bad" }),
      now: () => clock,
      store: createVisitorStore(() => storage, 2026),
    });
    await expect(broken.getLeaderboard()).rejects.toThrow(/parse-failed/);
  });
});

describe("squiggleServiceDemo", () => {
  const squiggle = () =>
    createSquiggleServiceDemo({
      loadSnapshot: async () => ({ ok: true, snapshot }),
      now: () => clock,
    });

  it("hides results of Games after the Demo clock", async () => {
    clock = T0 + HOUR; // game 1 done only
    const all = await squiggle().getGames();
    expect(all.map((g) => [g.id, g.complete])).toEqual([
      [1, 100],
      [2, 0],
      [3, 0],
    ]);
    expect(all.find((g) => g.id === 2)).toMatchObject({ homeScore: null, winnerTeamId: null });
  });

  it("filters Games by Round", async () => {
    expect((await squiggle().getGames(2)).map((g) => g.id)).toEqual([3]);
  });

  it("lists the incomplete Games in start order", async () => {
    clock = T0 + HOUR;
    expect((await squiggle().getIncompleteGames()).map((g) => g.id)).toEqual([2, 3]);
  });

  it("returns the Model tips for a Round", async () => {
    expect((await squiggle().getModelTips(1)).map((t) => t.gameId)).toEqual([1, 2]);
  });

  it("returns the teams", async () => {
    expect(await squiggle().getAllCurrentTeams()).toHaveLength(1);
  });
});
