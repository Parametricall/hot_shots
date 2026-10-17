import { describe, it, expect } from "vite-plus/test";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflModelTip } from "~/features/afl-tipping/types";
import {
  TIP_REJECTION_MESSAGES,
  buildGroupTips,
  buildLeaderboard,
  buildPlayerStats,
  buildTipsterTips,
  judgeTip,
  type Tipsters,
} from "./competition";
import type { AllTipsRow } from "./tips.repository";

const T0 = new Date("2026-04-01T09:00:00Z").getTime();
const HOUR = 1000 * 60 * 60;
const LONG_AGO = T0 - 1000 * HOUR;

function game(id: number, overrides: Parameters<typeof createAflGame>[0] = {}) {
  const unixTime = T0 + id * HOUR;
  return createAflGame({
    id,
    round: 1,
    unixTime,
    date: new Date(unixTime),
    homeTeamId: 10 + id,
    awayTeamId: 20 + id,
    ...overrides,
  });
}

/** A finished Game the home team won by `margin` points. */
function finished(id: number, margin = 10, overrides: Parameters<typeof createAflGame>[0] = {}) {
  return game(id, {
    complete: 100,
    homeScore: 80 + margin,
    awayScore: 80,
    winnerTeamId: 10 + id,
    ...overrides,
  });
}

function tip(
  gameId: number,
  userId: string,
  teamId: number,
  extra: Partial<AllTipsRow> = {},
): AllTipsRow {
  return {
    game_id: gameId,
    user_id: userId,
    tip: teamId,
    margin: null,
    is_underdog: null,
    created_at: new Date(T0).toISOString(),
    ...extra,
  };
}

function tipsters(...ids: string[]): Tipsters {
  return new Map(
    ids.map((id) => [id, { displayName: `Tipster ${id}`, avatarUrl: null, joinedAt: LONG_AGO }]),
  );
}

const AFTER_ALL = T0 + 1000 * HOUR;

describe("judgeTip", () => {
  const g = game(1);
  const modelTip: AflModelTip = {
    awayTeamId: 21,
    homeTeamId: 11,
    confidence: 60,
    gameId: 1,
    homeConfidence: 60,
    awayConfidence: 40,
    round: 1,
    tipTeamId: 11,
  };

  it("rejects a Tip for a Game that does not exist", () => {
    expect(judgeTip({ game: undefined, teamId: 11, modelTip: undefined, now: T0 })).toEqual({
      ok: false,
      reason: "game-not-found",
    });
  });

  it("rejects a Tip once the Game has started", () => {
    expect(judgeTip({ game: g, teamId: 11, modelTip, now: g.unixTime })).toEqual({
      ok: false,
      reason: "game-started",
    });
  });

  it("accepts a Tip before the Game starts", () => {
    expect(judgeTip({ game: g, teamId: 11, modelTip, now: g.unixTime - 1 })).toEqual({
      ok: true,
      isUnderdog: false,
    });
  });

  it("marks a Tip against the Model tip as an Underdog tip", () => {
    const verdict = judgeTip({ game: g, teamId: 21, modelTip, now: g.unixTime - 1 });
    expect(verdict).toEqual({ ok: true, isUnderdog: true });
  });

  it("leaves isUnderdog undefined without a Model tip", () => {
    const verdict = judgeTip({ game: g, teamId: 21, modelTip: undefined, now: g.unixTime - 1 });
    expect(verdict).toEqual({ ok: true, isUnderdog: undefined });
  });

  it("has a message for every rejection", () => {
    expect(TIP_REJECTION_MESSAGES["game-not-found"]).toMatch(/not found/i);
    expect(TIP_REJECTION_MESSAGES["game-started"]).toMatch(/started/i);
  });
});

describe("buildTipsterTips", () => {
  it("adds a Home team Auto-tip for a started Game the Tipster missed", () => {
    const result = buildTipsterTips({
      storedTips: [{ gameId: 1, tipTeamId: 21 }],
      games: [game(1), game(2)],
      gameIds: [1, 2],
      userId: "u1",
      joinedAt: LONG_AGO,
      now: AFTER_ALL,
    });
    expect(result).toEqual([
      { gameId: 1, tipTeamId: 21 },
      { gameId: 2, tipTeamId: 12, isAutoTip: true },
    ]);
  });

  it("gives no Auto-tip for Games from before the Tipster joined", () => {
    const g = game(1);
    const result = buildTipsterTips({
      storedTips: [],
      games: [g],
      gameIds: [1],
      userId: "u1",
      joinedAt: g.unixTime + 1,
      now: AFTER_ALL,
    });
    expect(result).toEqual([]);
  });

  it("gives no Auto-tip for a Game that has not started", () => {
    const g = game(1);
    const result = buildTipsterTips({
      storedTips: [],
      games: [g],
      gameIds: [1],
      userId: "u1",
      joinedAt: LONG_AGO,
      now: g.unixTime - 1,
    });
    expect(result).toEqual([]);
  });

  it("only covers the requested Games", () => {
    const result = buildTipsterTips({
      storedTips: [],
      games: [game(1), game(2)],
      gameIds: [2],
      userId: "u1",
      joinedAt: LONG_AGO,
      now: AFTER_ALL,
    });
    expect(result.map((t) => t.gameId)).toEqual([2]);
  });
});

describe("buildLeaderboard", () => {
  it("ranks by Score", () => {
    const games = [finished(1), finished(2)];
    const board = buildLeaderboard({
      tips: [
        tip(1, "a", 11),
        tip(2, "a", 22),
        tip(1, "b", 11),
        tip(2, "b", 12),
        tip(1, "c", 21),
        tip(2, "c", 22),
      ],
      games,
      tipsters: tipsters("a", "b", "c"),
      now: AFTER_ALL,
    });
    expect(board.map((e) => [e.userId, e.score])).toEqual([
      ["b", 2],
      ["a", 1],
      ["c", 0],
    ]);
  });

  it("breaks a tie on Score by the lowest Margin difference", () => {
    // Game 1 is the Round's first Game, so it is the Margin game: home won by 10.
    const games = [finished(1, 10)];
    const board = buildLeaderboard({
      tips: [tip(1, "far", 11, { margin: 40 }), tip(1, "near", 11, { margin: 12 })],
      games,
      tipsters: tipsters("far", "near"),
      now: AFTER_ALL,
    });
    expect(board.map((e) => [e.userId, e.totalMarginDiff])).toEqual([
      ["near", 2],
      ["far", 30],
    ]);
  });

  it("adds the Margin to the difference when the tipped team lost", () => {
    const games = [finished(1, 10)];
    const board = buildLeaderboard({
      tips: [tip(1, "wrong", 21, { margin: 15 })],
      games,
      tipsters: tipsters("wrong"),
      now: AFTER_ALL,
    });
    expect(board[0]!).toMatchObject({ score: 0, totalMarginDiff: 25 });
  });

  it("scores a Draw as wrong for everyone", () => {
    const draw = game(1, {
      complete: 100,
      homeScore: 80,
      awayScore: 80,
      winnerTeamId: null,
    });
    const board = buildLeaderboard({
      tips: [tip(1, "a", 11), tip(1, "b", 21)],
      games: [draw],
      tipsters: tipsters("a", "b"),
      now: AFTER_ALL,
    });
    expect(board.map((e) => e.score)).toEqual([0, 0]);
  });

  it("lists Tipsters who have no Tips", () => {
    const board = buildLeaderboard({
      tips: [tip(1, "a", 11)],
      games: [finished(1)],
      tipsters: tipsters("a", "ghost"),
      now: T0 - HOUR,
    });
    expect(board.map((e) => e.userId).sort()).toEqual(["a", "ghost"]);
    expect(board.find((e) => e.userId === "ghost")).toMatchObject({
      score: 0,
      totalMarginDiff: 0,
    });
  });

  it("scores a missed Game as an Auto-tip on the Home team", () => {
    const board = buildLeaderboard({
      tips: [],
      games: [finished(1)],
      tipsters: tipsters("a"),
      now: AFTER_ALL,
    });
    expect(board[0]!).toMatchObject({ score: 1, totalMarginDiff: 10 });
  });

  it("gives no Auto-tip for Games from before the Tipster joined", () => {
    const g = finished(1);
    const late: Tipsters = new Map([
      ["late", { displayName: "Late", avatarUrl: null, joinedAt: g.unixTime + 1 }],
    ]);
    const board = buildLeaderboard({ tips: [], games: [g], tipsters: late, now: AFTER_ALL });
    expect(board[0]!).toMatchObject({ score: 0 });
  });
});

describe("buildGroupTips", () => {
  const roundGames = [game(1), game(2)];

  it("hides other Tipsters' teams and Margins before Lockout", () => {
    const entries = buildGroupTips({
      tips: [tip(1, "a", 11, { margin: 30 })],
      roundGames,
      tipsters: tipsters("a"),
      now: roundGames[0]!.unixTime - 1,
    });
    const entry = entries.find((e) => e.gameId === 1 && e.userId === "a")!;
    expect(entry).toMatchObject({
      hasTipped: true,
      tipTeamId: null,
      margin: undefined,
      hasMargin: true,
    });
  });

  it("reveals the team and Margin once the Game has started", () => {
    const entries = buildGroupTips({
      tips: [tip(1, "a", 11, { margin: 30 })],
      roundGames,
      tipsters: tipsters("a"),
      now: roundGames[0]!.unixTime,
    });
    const entry = entries.find((e) => e.gameId === 1 && e.userId === "a")!;
    expect(entry).toMatchObject({ tipTeamId: 11, margin: 30, hasMargin: undefined });
  });

  it("only shows a Margin on the Round's first Game", () => {
    const entries = buildGroupTips({
      tips: [tip(2, "a", 12, { margin: 30 })],
      roundGames,
      tipsters: tipsters("a"),
      now: AFTER_ALL,
    });
    const entry = entries.find((e) => e.gameId === 2 && e.userId === "a")!;
    expect(entry.margin).toBeUndefined();
  });

  it("lists a Tipster without a Tip as untipped", () => {
    const entries = buildGroupTips({
      tips: [tip(1, "a", 11)],
      roundGames,
      tipsters: tipsters("a", "b"),
      now: roundGames[0]!.unixTime - 1,
    });
    const untipped = entries.filter((e) => !e.hasTipped);
    expect(untipped.map((e) => [e.userId, e.gameId]).sort()).toEqual([
      ["a", 2],
      ["b", 1],
      ["b", 2],
    ]);
    expect(untipped.every((e) => e.tipTeamId === null)).toBe(true);
  });

  it("flags Auto-tips and never counts them as untipped", () => {
    const entries = buildGroupTips({
      tips: [],
      roundGames,
      tipsters: tipsters("a"),
      now: AFTER_ALL,
    });
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.hasTipped && e.isAutoTip && e.tipTeamId !== null)).toBe(true);
  });
});

describe("buildPlayerStats", () => {
  it("never counts an Auto-tip as an Underdog tip", () => {
    const stats = buildPlayerStats({
      tips: [],
      games: [finished(1)],
      tipsters: tipsters("a"),
      now: AFTER_ALL,
    });
    expect(stats[0]!.season.totalUnderdogs).toBe(0);
    expect(stats[0]!.season.correctTips).toBe(1);
  });

  it("sorts by correct tips, then by the lowest Margin difference", () => {
    const games = [finished(1, 10), finished(2, 10)];
    const stats = buildPlayerStats({
      tips: [
        tip(1, "low", 11, { margin: 10 }),
        tip(2, "low", 12),
        tip(1, "high", 11, { margin: 30 }),
        tip(2, "high", 12),
        tip(1, "none", 21),
        tip(2, "none", 22),
      ],
      games,
      tipsters: tipsters("none", "high", "low"),
      now: AFTER_ALL,
    });
    expect(stats.map((e) => e.userId)).toEqual(["low", "high", "none"]);
  });

  it("counts Underdog tips per Round", () => {
    const stats = buildPlayerStats({
      tips: [tip(1, "a", 21, { is_underdog: true }), tip(2, "a", 12, { is_underdog: false })],
      games: [finished(1), finished(2)],
      tipsters: tipsters("a"),
      now: AFTER_ALL,
    });
    expect(stats[0]!.rounds[0]).toMatchObject({ underdogCount: 1, meetsMinimum: false });
  });
});
