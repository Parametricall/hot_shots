import { describe, it, expect } from "vite-plus/test";
import {
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";
import type { AflPlayerSeasonStats } from "~/features/afl-tipping/types";
import { awardsWonBy, isPerfectRound, seasonAwards } from "./season-awards";

const PERFECT = { correctTips: 9, gamesTipped: 9, gamesCompleted: 9, totalGames: 9 };

function tipster(
  userId: string,
  season: Partial<AflPlayerSeasonStats> = {},
  rounds: ReturnType<typeof createAflPlayerRoundStats>[] = [],
) {
  return createAflPlayerStatsEntry({
    userId,
    displayName: `Tipster ${userId}`,
    season: { longestStreak: 0, totalUnderdogs: 0, totalMarginDiff: 0, ...season },
    rounds,
  });
}

function award(stats: ReturnType<typeof tipster>[], id: string) {
  return seasonAwards(stats).find((a) => a.id === id);
}

describe("isPerfectRound", () => {
  it("needs every Game completed, tipped and correct", () => {
    expect(isPerfectRound(createAflPlayerRoundStats(PERFECT))).toBe(true);
    expect(isPerfectRound(createAflPlayerRoundStats({ ...PERFECT, correctTips: 8 }))).toBe(false);
    expect(isPerfectRound(createAflPlayerRoundStats({ ...PERFECT, gamesTipped: 8 }))).toBe(false);
    expect(isPerfectRound(createAflPlayerRoundStats({ ...PERFECT, gamesCompleted: 8 }))).toBe(
      false,
    );
  });
});

describe("seasonAwards", () => {
  it("gives Longest streak to the highest streak", () => {
    const a = award(
      [tipster("a", { longestStreak: 7 }), tipster("b", { longestStreak: 4 })],
      "longest-streak",
    );
    expect(a?.winners.map((w) => w.userId)).toEqual(["a"]);
    expect(a?.value).toBe(7);
  });

  it("shares an award between everyone tied on the best value", () => {
    const a = award(
      [
        tipster("a", { totalUnderdogs: 12 }),
        tipster("b", { totalUnderdogs: 12 }),
        tipster("c", { totalUnderdogs: 3 }),
      ],
      "underdog-tips",
    );
    expect(a?.winners.map((w) => w.userId)).toEqual(["a", "b"]);
  });

  it("hides an award whose best value is 0, and every award with nobody to judge", () => {
    expect(award([tipster("a"), tipster("b")], "longest-streak")).toBeUndefined();
    expect(award([tipster("a"), tipster("b")], "perfect-rounds")).toBeUndefined();
    expect(award([tipster("a")], "best-round")).toBeUndefined();
    expect(seasonAwards([])).toEqual([]);
  });

  it("counts Perfect rounds", () => {
    const a = award(
      [
        tipster("a", {}, [
          createAflPlayerRoundStats({ round: 1, ...PERFECT }),
          createAflPlayerRoundStats({ round: 2, ...PERFECT }),
        ]),
        tipster("b", {}, [
          createAflPlayerRoundStats({ round: 1, ...PERFECT }),
          createAflPlayerRoundStats({ round: 2, ...PERFECT, correctTips: 8 }),
        ]),
      ],
      "perfect-rounds",
    );
    expect(a?.winners.map((w) => w.userId)).toEqual(["a"]);
    expect(a?.value).toBe(2);
  });

  it("names the Round of the Best round, and every Round the winners reached it", () => {
    const a = award(
      [
        tipster("a", {}, [
          createAflPlayerRoundStats({ round: 3, correctTips: 8 }),
          createAflPlayerRoundStats({ round: 9, correctTips: 8 }),
        ]),
        tipster("b", {}, [createAflPlayerRoundStats({ round: 5, correctTips: 8 })]),
        tipster("c", {}, [createAflPlayerRoundStats({ round: 6, correctTips: 6 })]),
      ],
      "best-round",
    );
    expect(a?.value).toBe(8);
    expect(a?.winners.map((w) => w.userId)).toEqual(["a", "b"]);
    expect(a?.rounds).toEqual([3, 5, 9]);
  });

  it("gives Closest Margins to the lowest total, among Tipsters with a Margin difference", () => {
    const withMargin = (marginDiff: number | null) => [createAflPlayerRoundStats({ marginDiff })];
    const a = award(
      [
        tipster("a", { totalMarginDiff: 40 }, withMargin(40)),
        tipster("b", { totalMarginDiff: 25 }, withMargin(25)),
        tipster("none", { totalMarginDiff: 0 }, withMargin(null)),
      ],
      "closest-margins",
    );
    expect(a?.winners.map((w) => w.userId)).toEqual(["b"]);
    expect(a?.value).toBe(25);
  });

  it("has no Closest Margins when nobody has a Margin difference", () => {
    expect(
      award(
        [tipster("a", {}, [createAflPlayerRoundStats({ marginDiff: null })])],
        "closest-margins",
      ),
    ).toBeUndefined();
  });
});

describe("awardsWonBy", () => {
  it("lists the awards a Tipster won", () => {
    const awards = seasonAwards([
      tipster("a", { longestStreak: 7, totalUnderdogs: 1 }),
      tipster("b", { longestStreak: 3, totalUnderdogs: 9 }),
    ]);
    expect(awardsWonBy(awards, "a").map((x) => x.title)).toEqual(["Longest streak"]);
    expect(awardsWonBy(awards, undefined)).toEqual([]);
  });
});
