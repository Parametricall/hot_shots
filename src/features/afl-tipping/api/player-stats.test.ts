import { describe, it, expect } from "vite-plus/test";
import { computePlayerStats, type PlayerStatsTip } from "./player-stats";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflGame } from "~/features/afl-tipping/types";

const HOUR = 1000 * 60 * 60;
const SEASON_START = new Date("2026-03-01T09:00:00Z").getTime();

function completedGame(overrides: Partial<AflGame> & { id: number; round: number }): AflGame {
  const unixTime = SEASON_START + overrides.round * 24 * HOUR + overrides.id * HOUR;
  return createAflGame({
    unixTime,
    date: new Date(unixTime),
    homeScore: 100,
    awayScore: 80,
    winnerTeamId: 1,
    complete: 100,
    ...overrides,
  });
}

function upcomingGame(overrides: Partial<AflGame> & { id: number; round: number }): AflGame {
  const unixTime = SEASON_START + overrides.round * 24 * HOUR + overrides.id * HOUR;
  return createAflGame({ unixTime, date: new Date(unixTime), complete: 0, ...overrides });
}

function makeTip(overrides: Partial<PlayerStatsTip> & { game_id: number }): PlayerStatsTip {
  return {
    user_id: "user-1",
    tip: 1,
    margin: null,
    is_underdog: false,
    ...overrides,
  };
}

describe("computePlayerStats", () => {
  it("counts correct tips per round and across the season", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 1, winnerTeamId: 2 }),
      completedGame({ id: 3, round: 2, winnerTeamId: 1 }),
    ];
    const tips = [
      makeTip({ game_id: 1, tip: 1 }), // correct
      makeTip({ game_id: 2, tip: 1 }), // wrong
      makeTip({ game_id: 3, tip: 1 }), // correct
    ];

    const { byUser } = computePlayerStats(tips, games);
    const stats = byUser.get("user-1")!;

    expect(stats.rounds).toHaveLength(2);
    expect(stats.rounds[0]).toMatchObject({ round: 1, correctTips: 1, gamesTipped: 2 });
    expect(stats.rounds[1]).toMatchObject({ round: 2, correctTips: 1, gamesTipped: 1 });
    expect(stats.season.correctTips).toBe(2);
    expect(stats.season.gamesTipped).toBe(3);
    expect(stats.season.gamesCompleted).toBe(3);
  });

  it("ignores tips on games that have not completed", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      upcomingGame({ id: 2, round: 1 }),
    ];
    const tips = [makeTip({ game_id: 1, tip: 1 }), makeTip({ game_id: 2, tip: 1 })];

    const { byUser } = computePlayerStats(tips, games);
    const stats = byUser.get("user-1")!;

    expect(stats.rounds[0]).toMatchObject({ correctTips: 1, gamesTipped: 1, gamesCompleted: 1 });
    expect(stats.season.gamesTipped).toBe(1);
  });

  it("computes margin diff only on the round's first game", () => {
    // Game 2 starts before game 1, so game 2 is the margin game (actual margin 20)
    const marginGame = completedGame({ id: 2, round: 1, winnerTeamId: 1 });
    const otherGame = completedGame({ id: 5, round: 1, winnerTeamId: 1 });
    const tips = [
      makeTip({ game_id: 2, tip: 1, margin: 12 }), // won margin game: |12 - 20| = 8
      makeTip({ game_id: 5, tip: 1, margin: 50 }), // not the margin game
    ];

    const { byUser } = computePlayerStats(tips, [otherGame, marginGame]);
    const stats = byUser.get("user-1")!;

    expect(stats.rounds[0]!.marginDiff).toBe(8);
    expect(stats.season.totalMarginDiff).toBe(8);
  });

  it("adds actual and tipped margins when the margin game tip was wrong", () => {
    const games = [completedGame({ id: 1, round: 1, winnerTeamId: 2 })]; // actual margin 20
    const tips = [makeTip({ game_id: 1, tip: 1, margin: 15 })]; // lost: 20 + 15 = 35

    const { byUser } = computePlayerStats(tips, games);

    expect(byUser.get("user-1")!.rounds[0]!.marginDiff).toBe(35);
  });

  it("leaves margin diff null when the user did not tip the margin game", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 1, winnerTeamId: 1 }),
    ];
    // Game 1 is the margin game (earlier unixTime); user only tipped game 2
    const tips = [makeTip({ game_id: 2, tip: 1 })];

    const { byUser } = computePlayerStats(tips, games);
    const stats = byUser.get("user-1")!;

    expect(stats.rounds[0]!.marginDiff).toBeNull();
    expect(stats.season.totalMarginDiff).toBe(0);
  });

  it("counts underdogs and flags whether the round minimum was met", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 3, round: 2, winnerTeamId: 1 }),
    ];
    const tips = [
      makeTip({ game_id: 1, tip: 2, is_underdog: true }),
      makeTip({ game_id: 2, tip: 2, is_underdog: true }),
      makeTip({ game_id: 3, tip: 2, is_underdog: true }),
    ];

    const { byUser } = computePlayerStats(tips, games);
    const stats = byUser.get("user-1")!;

    expect(stats.rounds[0]).toMatchObject({ underdogCount: 2, meetsMinimum: true });
    expect(stats.rounds[1]).toMatchObject({ underdogCount: 1, meetsMinimum: false });
    expect(stats.season.totalUnderdogs).toBe(3);
  });

  it("marks finals rounds as meeting the minimum regardless of underdog count", () => {
    const games = [completedGame({ id: 1, round: 25, winnerTeamId: 1, isFinals: true })];
    const tips = [makeTip({ game_id: 1, tip: 1, is_underdog: false })];

    const { byUser } = computePlayerStats(tips, games);

    expect(byUser.get("user-1")!.rounds[0]).toMatchObject({
      isFinals: true,
      underdogCount: 0,
      meetsMinimum: true,
    });
  });

  it("includes an in-progress round once underdog-tracked tips exist for it", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      upcomingGame({ id: 2, round: 2 }),
    ];
    const tips = [
      makeTip({ game_id: 1, tip: 1 }),
      makeTip({ game_id: 2, tip: 2, is_underdog: true }),
    ];

    const { byUser } = computePlayerStats(tips, games);
    const stats = byUser.get("user-1")!;

    expect(stats.rounds.map((r) => r.round)).toEqual([1, 2]);
    expect(stats.rounds[1]).toMatchObject({ underdogCount: 1, gamesCompleted: 0 });
  });

  it("computes accuracy as a percentage of completed tipped games", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 3, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 4, round: 1, winnerTeamId: 1 }),
    ];
    // Tipped only 3 of 4 games: missing games don't hurt accuracy
    const tips = [
      makeTip({ game_id: 1, tip: 1 }),
      makeTip({ game_id: 2, tip: 1 }),
      makeTip({ game_id: 3, tip: 2 }),
    ];

    const { byUser } = computePlayerStats(tips, games);

    expect(byUser.get("user-1")!.season.accuracy).toBeCloseTo((2 / 3) * 100);
  });

  it("tracks current and longest correct-tip streaks in game order, skipping untipped games", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 3, round: 2, winnerTeamId: 1 }),
      completedGame({ id: 4, round: 2, winnerTeamId: 1 }),
      completedGame({ id: 5, round: 3, winnerTeamId: 1 }),
    ];
    const tips = [
      makeTip({ game_id: 1, tip: 1 }), // correct
      makeTip({ game_id: 2, tip: 1 }), // correct
      // game 3 not tipped: streak survives
      makeTip({ game_id: 4, tip: 2 }), // wrong: streak resets
      makeTip({ game_id: 5, tip: 1 }), // correct
    ];

    const { byUser } = computePlayerStats(tips, games);
    const { currentStreak, longestStreak } = byUser.get("user-1")!.season;

    expect(longestStreak).toBe(2);
    expect(currentStreak).toBe(1);
  });

  it("tracks users independently", () => {
    const games = [completedGame({ id: 1, round: 1, winnerTeamId: 1 })];
    const tips = [
      makeTip({ game_id: 1, tip: 1, user_id: "user-1" }),
      makeTip({ game_id: 1, tip: 2, user_id: "user-2" }),
    ];

    const { byUser } = computePlayerStats(tips, games);

    expect(byUser.get("user-1")!.season.correctTips).toBe(1);
    expect(byUser.get("user-2")!.season.correctTips).toBe(0);
  });

  it("makeEmptyStats returns zeroed stats with the full round skeleton", () => {
    const games = [
      completedGame({ id: 1, round: 1, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 2, winnerTeamId: 1, isFinals: true }),
    ];
    const tips = [makeTip({ game_id: 1, tip: 1 })];

    const { makeEmptyStats } = computePlayerStats(tips, games);
    const empty = makeEmptyStats();

    expect(empty.season).toMatchObject({
      correctTips: 0,
      gamesTipped: 0,
      gamesCompleted: 2,
      accuracy: null,
      currentStreak: 0,
      longestStreak: 0,
    });
    expect(empty.rounds).toHaveLength(2);
    expect(empty.rounds[0]).toMatchObject({ round: 1, meetsMinimum: false });
    expect(empty.rounds[1]).toMatchObject({ round: 2, isFinals: true, meetsMinimum: true });
  });
});
