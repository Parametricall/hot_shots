import { describe, it, expect } from "vitest";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import type { AflGame } from "~/features/afl-tipping/types";

function makeGame(overrides: Partial<AflGame> = {}): AflGame {
  return {
    id: 1,
    round: 1,
    roundName: "Round 1",
    venue: { name: "MCG" },
    unixTime: 0,
    date: new Date(0),
    timeStr: "7:30pm",
    homeTeamId: 10,
    homeScore: null,
    awayTeamId: 20,
    awayScore: null,
    winnerTeamId: null,
    complete: 0,
    isFinals: false,
    isGrandFinal: false,
    ...overrides,
  };
}

describe("GameRules.getActualMargin", () => {
  it("returns the score difference for a complete game", () => {
    const game = makeGame({ complete: 100, homeScore: 90, awayScore: 70 });
    expect(GameRules.getActualMargin(game)).toBe(20);
  });

  it("returns the absolute difference regardless of which team won", () => {
    const game = makeGame({ complete: 100, homeScore: 60, awayScore: 95 });
    expect(GameRules.getActualMargin(game)).toBe(35);
  });

  it("returns 0 for a draw", () => {
    const game = makeGame({ complete: 100, homeScore: 80, awayScore: 80 });
    expect(GameRules.getActualMargin(game)).toBe(0);
  });

  it("returns null for an incomplete game", () => {
    const game = makeGame({ complete: 50, homeScore: 60, awayScore: 40 });
    expect(GameRules.getActualMargin(game)).toBeNull();
  });

  it("returns null when homeScore is null", () => {
    const game = makeGame({ complete: 100, homeScore: null, awayScore: 80 });
    expect(GameRules.getActualMargin(game)).toBeNull();
  });

  it("returns null when awayScore is null", () => {
    const game = makeGame({ complete: 100, homeScore: 80, awayScore: null });
    expect(GameRules.getActualMargin(game)).toBeNull();
  });
});

describe("GameRules.calculateMarginDiff", () => {
  describe("tipped team won", () => {
    it("returns 0 when predicted margin matches actual", () => {
      expect(GameRules.calculateMarginDiff(20, 20, true)).toBe(0);
    });

    it("returns the difference when predicted margin is too high", () => {
      expect(GameRules.calculateMarginDiff(30, 10, true)).toBe(20);
    });

    it("returns the difference when predicted margin is too low", () => {
      expect(GameRules.calculateMarginDiff(5, 25, true)).toBe(20);
    });

    it("returns actual margin when predicted margin is 0 (default for unset margin)", () => {
      expect(GameRules.calculateMarginDiff(0, 30, true)).toBe(30);
    });
  });

  describe("tipped team lost", () => {
    it("returns actual margin + predicted margin", () => {
      expect(GameRules.calculateMarginDiff(20, 10, false)).toBe(30);
    });

    it("returns actual margin when predicted margin is 0", () => {
      expect(GameRules.calculateMarginDiff(0, 15, false)).toBe(15);
    });

    it("returns larger diff for a bigger wrong prediction", () => {
      expect(GameRules.calculateMarginDiff(50, 10, false)).toBe(60);
    });
  });
});
