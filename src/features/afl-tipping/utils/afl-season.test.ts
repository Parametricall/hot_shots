import { describe, it, expect } from "vite-plus/test";
import {
  landingFor,
  listSeasons,
  podium,
  rankEntries,
  resolveCurrentSeason,
  seasonStatus,
  woodenSpoon,
} from "~/features/afl-tipping/utils/afl-season";
import { createAflGame, createAflLeaderboardEntry } from "~/features/afl-tipping/mocks/factories";

const NOW = 1_000_000;

function entry(userId: string, score: number, totalMarginDiff = 0) {
  return createAflLeaderboardEntry({ userId, displayName: userId, score, totalMarginDiff });
}

describe("seasonStatus", () => {
  it("is upcoming before the first bounce", () => {
    const games = [createAflGame({ unixTime: NOW + 1 }), createAflGame({ unixTime: NOW + 99 })];
    expect(seasonStatus(games, NOW)).toBe("upcoming");
  });

  it("is upcoming with no Games", () => {
    expect(seasonStatus([], NOW)).toBe("upcoming");
  });

  it("is in-progress once a Game has started", () => {
    const games = [createAflGame({ unixTime: NOW - 1 }), createAflGame({ unixTime: NOW + 99 })];
    expect(seasonStatus(games, NOW)).toBe("in-progress");
  });

  it("is in-progress while only the Grand Final is still to finish", () => {
    const games = [
      createAflGame({ unixTime: NOW - 99, complete: 100 }),
      createAflGame({ unixTime: NOW + 99, complete: 0, isGrandFinal: true }),
    ];
    expect(seasonStatus(games, NOW)).toBe("in-progress");
  });

  it("is over when the Grand Final was the last Game to complete", () => {
    const games = [
      createAflGame({ unixTime: NOW - 99, complete: 100 }),
      createAflGame({ unixTime: NOW - 9, complete: 100, isGrandFinal: true }),
    ];
    expect(seasonStatus(games, NOW)).toBe("over");
  });
});

describe("resolveCurrentSeason", () => {
  it("is the earliest Season with a Game to finish, even when the next Fixture is out", () => {
    const incompleteGames = [
      createAflGame({ season: 2027, round: 0 }),
      createAflGame({ season: 2026, round: 27, isGrandFinal: true }),
      createAflGame({ season: 2027, round: 1 }),
    ];
    expect(resolveCurrentSeason({ incompleteGames, latestSeasonWithGames: 2027 })).toBe(2026);
  });

  it("is the next Season once the old one has no Game left", () => {
    const incompleteGames = [createAflGame({ season: 2027 })];
    expect(resolveCurrentSeason({ incompleteGames, latestSeasonWithGames: 2027 })).toBe(2027);
  });

  it("falls back to the newest Season with Games when none are incomplete", () => {
    expect(resolveCurrentSeason({ incompleteGames: [], latestSeasonWithGames: 2026 })).toBe(2026);
  });
});

describe("listSeasons", () => {
  it("lists Seasons newest first, down to the first", () => {
    expect(listSeasons(2028)).toEqual([2028, 2027, 2026]);
    expect(listSeasons(2026)).toEqual([2026]);
  });
});

describe("landingFor", () => {
  it("lands on tips while the Season is upcoming or in progress", () => {
    const base = { season: 2027, firstGameAt: null };
    expect(landingFor({ ...base, status: "upcoming" })).toEqual({ to: "tips", season: 2027 });
    expect(landingFor({ ...base, status: "in-progress" })).toEqual({ to: "tips", season: 2027 });
  });

  it("lands on the summary once the Season is over", () => {
    expect(landingFor({ season: 2026, status: "over", firstGameAt: null })).toEqual({
      to: "summary",
      season: 2026,
    });
  });
});

describe("rankEntries", () => {
  it("shares a rank between Tipsters level on score and margin", () => {
    const entries = [entry("a", 9), entry("b", 7, 5), entry("c", 7, 5), entry("d", 7, 6)];
    expect(rankEntries(entries)).toEqual([1, 2, 2, 4]);
  });
});

describe("podium", () => {
  it("is [] before any Game is complete", () => {
    expect(podium([entry("a", 0), entry("b", 0)])).toEqual([]);
    expect(podium([])).toEqual([]);
  });

  it("is the top three when ranks are all different", () => {
    const entries = [entry("a", 9), entry("b", 8), entry("c", 7), entry("d", 6)];
    expect(podium(entries).map((e) => e.userId)).toEqual(["a", "b", "c"]);
  });

  it("includes everyone tied on a podium rank", () => {
    const entries = [entry("a", 9), entry("b", 8), entry("c", 8), entry("d", 8), entry("e", 5)];
    expect(podium(entries).map((e) => e.userId)).toEqual(["a", "b", "c", "d"]);
  });

  it("is everyone when every rank is level", () => {
    const entries = [entry("a", 5, 10), entry("b", 5, 10), entry("c", 5, 10), entry("d", 5, 10)];
    expect(podium(entries)).toHaveLength(4);
  });

  it("is fewer than three Tipsters when that is all there are", () => {
    expect(podium([entry("a", 3), entry("b", 1)])).toHaveLength(2);
  });
});

describe("woodenSpoon", () => {
  it("is the Tipster on the last rank", () => {
    const entries = [entry("a", 9), entry("b", 8), entry("c", 7), entry("d", 6), entry("e", 2)];
    expect(woodenSpoon(entries).map((e) => e.userId)).toEqual(["e"]);
  });

  it("is shared by Tipsters level on the last rank", () => {
    const entries = [
      entry("a", 9),
      entry("b", 8),
      entry("c", 7),
      entry("d", 6),
      entry("e", 2, 4),
      entry("f", 2, 4),
    ];
    expect(woodenSpoon(entries).map((e) => e.userId)).toEqual(["e", "f"]);
  });

  it("is [] with three Tipsters in all, who are all on the podium", () => {
    expect(woodenSpoon([entry("a", 9), entry("b", 8), entry("c", 7)])).toEqual([]);
  });

  it("is [] when every rank is level", () => {
    expect(woodenSpoon([entry("a", 5), entry("b", 5), entry("c", 5), entry("d", 5)])).toEqual([]);
  });

  it("is [] with nobody", () => {
    expect(woodenSpoon([])).toEqual([]);
  });
});
