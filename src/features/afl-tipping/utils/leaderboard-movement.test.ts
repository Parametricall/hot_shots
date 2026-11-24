import { describe, expect, it } from "vite-plus/test";
import {
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";
import { leaderboardMovement } from "./leaderboard-movement";

const round = (n: number, correctTips: number, marginDiff = 0, gamesCompleted = 9) =>
  createAflPlayerRoundStats({ round: n, correctTips, marginDiff, gamesCompleted });

const entry = (userId: string, rounds: ReturnType<typeof round>[]) =>
  createAflPlayerStatsEntry({ userId, rounds });

describe("leaderboardMovement", () => {
  it("has no Round before a Game is complete", () => {
    const stats = [entry("a", [round(1, 0, 0, 0)])];
    expect(leaderboardMovement(stats)).toEqual({ round: null, movement: {}, roundCorrect: {} });
  });

  it("has no movement in the first completed Round", () => {
    const result = leaderboardMovement([entry("a", [round(1, 6)]), entry("b", [round(1, 4)])]);
    expect(result.round).toBe(1);
    expect(result.movement).toEqual({ a: null, b: null });
    expect(result.roundCorrect).toEqual({ a: 6, b: 4 });
  });

  it("is the places gained or lost by re-ranking without the latest Round", () => {
    const result = leaderboardMovement([
      entry("a", [round(1, 7), round(2, 2)]), // 9, was 1st, now 2nd
      entry("b", [round(1, 5), round(2, 8)]), // 13, was 2nd, now 1st
      entry("c", [round(1, 3), round(2, 3)]), // 6, 3rd both times
    ]);
    expect(result.round).toBe(2);
    expect(result.movement).toEqual({ a: -1, b: 1, c: 0 });
    expect(result.roundCorrect).toEqual({ a: 2, b: 8, c: 3 });
  });

  it("breaks a tie on Score by the lowest Margin difference and shares rank when level", () => {
    const result = leaderboardMovement([
      entry("a", [round(1, 5, 30), round(2, 5, 0)]), // 10, margin 30
      entry("b", [round(1, 5, 10), round(2, 5, 10)]), // 10, margin 20: ahead of a
      entry("c", [round(1, 5, 10), round(2, 5, 10)]), // level with b
    ]);
    // Before Round 2: b and c (5, 10) share 1st, a (5, 30) is 3rd. After: b and c share 1st, a 3rd.
    expect(result.movement).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("treats a missing margin as 0", () => {
    const result = leaderboardMovement([
      entry("a", [
        round(1, 5),
        createAflPlayerRoundStats({ round: 2, correctTips: 1, marginDiff: null }),
      ]),
    ]);
    expect(result.movement).toEqual({ a: 0 });
  });
});
