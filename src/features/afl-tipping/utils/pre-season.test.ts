import { describe, it, expect } from "vite-plus/test";
import { createAflLeaderboardEntry } from "~/features/afl-tipping/mocks/factories";
import { daysUntil, preSeason } from "~/features/afl-tipping/utils/pre-season";

function entry(userId: string, score: number, totalMarginDiff = 0) {
  return createAflLeaderboardEntry({
    userId,
    displayName: `Tipster ${userId}`,
    score,
    totalMarginDiff,
  });
}

const entered = (...ids: string[]) => ids.map((id) => entry(id, 0));
const LAST = [entry("a", 9), entry("b", 8), entry("c", 7), entry("d", 6), entry("e", 2)];

describe("preSeason", () => {
  it("orders entrants by last Season's rank, then new Tipsters by name", () => {
    const result = preSeason(entered("zed", "d", "amy", "a", "c"), LAST);
    expect(result.entrants.map((e) => e.entry.userId)).toEqual(["a", "c", "d", "amy", "zed"]);
    expect(result.entrants.map((e) => e.lastRank)).toEqual([1, 3, 4, null, null]);
  });

  it("marks a shared last Season rank as tied", () => {
    const last = [entry("a", 9), entry("b", 8, 5), entry("c", 8, 5)];
    const result = preSeason(entered("a", "b", "c"), last);
    expect(result.entrants.map((e) => [e.lastRank, e.lastRankIsTied])).toEqual([
      [1, false],
      [2, true],
      [2, true],
    ]);
  });

  it("finds the Champion back, or not back yet", () => {
    expect(preSeason(entered("a"), LAST).champions).toMatchObject([
      { entry: { userId: "a" }, rank: 1, isBack: true },
    ]);
    expect(preSeason(entered("b"), LAST).champions).toMatchObject([{ isBack: false }]);
  });

  it("returns every Champion when rank 1 is tied", () => {
    const last = [entry("a", 9, 3), entry("b", 9, 3), entry("c", 5)];
    const result = preSeason(entered("a"), last);
    expect(result.champions.map((c) => [c.entry.userId, c.isBack])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("has no Champion when last Season scored nothing", () => {
    const result = preSeason(entered("a"), [entry("a", 0), entry("b", 0)]);
    expect(result.champions).toEqual([]);
  });

  it("finds the Wooden spoon and whether they are back", () => {
    expect(preSeason(entered("e"), LAST).woodenSpoon).toMatchObject([
      { entry: { userId: "e" }, isBack: true },
    ]);
    expect(preSeason(entered("a"), LAST).woodenSpoon).toMatchObject([{ isBack: false }]);
    expect(preSeason(entered("a"), LAST.slice(0, 3)).woodenSpoon).toEqual([]);
  });

  it("lists last Season's Tipsters who haven't entered, in last Season's order", () => {
    const result = preSeason(entered("c", "a"), LAST);
    expect(result.notBack.map((t) => t.entry.userId)).toEqual(["b", "d", "e"]);
  });

  it("has nothing from last Season when there was none", () => {
    const result = preSeason(entered("x", "y"), null);
    expect(result).toMatchObject({
      hasPrevious: false,
      champions: [],
      woodenSpoon: [],
      notBack: [],
    });
    expect(result.entrants.map((e) => [e.entry.userId, e.lastRank])).toEqual([
      ["x", null],
      ["y", null],
    ]);
  });

  it("copes with no entrants", () => {
    const result = preSeason([], LAST);
    expect(result.entrants).toEqual([]);
    expect(result.notBack).toHaveLength(5);
  });
});

describe("daysUntil", () => {
  const OPENING = Date.UTC(2027, 2, 4, 8, 30); // 7:30pm Thursday 4 March, Melbourne
  it("counts calendar days in Melbourne", () => {
    expect(daysUntil(OPENING, OPENING)).toBe(0);
    expect(daysUntil(OPENING, OPENING - 3_600_000 * 20)).toBe(1);
    expect(daysUntil(OPENING, Date.UTC(2026, 11, 26, 3))).toBe(68);
  });

  it("never goes negative", () => {
    expect(daysUntil(OPENING, OPENING + 86_400_000 * 3)).toBe(0);
  });
});
