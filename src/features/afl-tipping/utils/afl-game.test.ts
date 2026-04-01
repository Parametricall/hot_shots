import { describe, it, expect, vi, afterEach } from "vitest";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";

afterEach(() => {
  vi.useRealTimers();
});

describe("AflGame.hasStarted", () => {
  it("returns true when the game time is in the past", () => {
    const game = createAflGame({ unixTime: Date.now() - 1000 });
    expect(AflGame.hasStarted(game)).toBe(true);
  });

  it("returns false when the game time is in the future", () => {
    const game = createAflGame({ unixTime: Date.now() + 100000 });
    expect(AflGame.hasStarted(game)).toBe(false);
  });
});

describe("AflGame.isComplete", () => {
  it("returns true when complete is 100", () => {
    expect(AflGame.isComplete(createAflGame({ complete: 100 }))).toBe(true);
  });

  it("returns false when complete is not 100", () => {
    expect(AflGame.isComplete(createAflGame({ complete: 50 }))).toBe(false);
    expect(AflGame.isComplete(createAflGame({ complete: 0 }))).toBe(false);
  });
});

describe("AflGame.getActiveRound", () => {
  it("returns the lowest round with incomplete games", () => {
    const games = [
      createAflGame({ round: 1, complete: 100 }),
      createAflGame({ round: 2, complete: 0 }),
      createAflGame({ round: 3, complete: 0 }),
    ];
    expect(AflGame.getActiveRound(games)).toBe(2);
  });

  it("returns 0 when all games are complete", () => {
    const games = [
      createAflGame({ round: 1, complete: 100 }),
      createAflGame({ round: 2, complete: 100 }),
    ];
    expect(AflGame.getActiveRound(games)).toBe(0);
  });
});

describe("AflGame.getFirstGameOfRound", () => {
  it("returns the game with the earliest unixTime", () => {
    const games = [
      createAflGame({ id: 1, unixTime: 3000 }),
      createAflGame({ id: 2, unixTime: 1000 }),
      createAflGame({ id: 3, unixTime: 2000 }),
    ];
    expect(AflGame.getFirstGameOfRound(games)?.id).toBe(2);
  });

  it("returns undefined for empty array", () => {
    expect(AflGame.getFirstGameOfRound([])).toBeUndefined();
  });
});

describe("AflGame.groupByRound", () => {
  it("groups games by round number", () => {
    const games = [
      createAflGame({ id: 1, round: 1 }),
      createAflGame({ id: 2, round: 1 }),
      createAflGame({ id: 3, round: 2 }),
    ];
    const grouped = AflGame.groupByRound(games);
    expect(grouped[1]).toHaveLength(2);
    expect(grouped[2]).toHaveLength(1);
  });
});
