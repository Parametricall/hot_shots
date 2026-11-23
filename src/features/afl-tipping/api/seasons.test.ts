import { describe, it, expect } from "vite-plus/test";
import { loadSeasons, melbourneYear } from "~/features/afl-tipping/api/seasons";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflGame } from "~/features/afl-tipping/types";

const DEC_2026 = Date.UTC(2026, 11, 1);

function fixture(byYear: Record<number, AflGame[]>) {
  return {
    fetchGames: async (season: number) => byYear[season] ?? [],
    fetchIncompleteGames: async (season: number) =>
      (byYear[season] ?? []).filter((g) => g.complete !== 100),
  };
}

const done = (season: number, unixTime: number) =>
  createAflGame({ season, unixTime, complete: 100 });
const todo = (season: number, unixTime: number) => createAflGame({ season, unixTime, complete: 0 });

describe("melbourneYear", () => {
  it("is already the new year in Melbourne when UTC is still 31 December", () => {
    expect(melbourneYear(Date.UTC(2026, 11, 31, 14, 30))).toBe(2027);
    expect(melbourneYear(Date.UTC(2026, 11, 31, 12, 0))).toBe(2026);
  });
});

describe("loadSeasons", () => {
  it("is last Season, over, when the next Fixture isn't out yet", async () => {
    const seasons = await loadSeasons({
      ...fixture({ 2026: [done(2026, 100), done(2026, 200)] }),
      now: DEC_2026,
    });
    expect(seasons).toEqual({
      seasons: [2026],
      current: { season: 2026, status: "over", firstGameAt: 100 },
    });
  });

  it("is the next Season, upcoming, once the old one is over and the Fixture is out", async () => {
    const seasons = await loadSeasons({
      ...fixture({ 2026: [done(2026, 100)], 2027: [todo(2027, Date.UTC(2027, 2, 17))] }),
      now: DEC_2026,
    });
    expect(seasons.seasons).toEqual([2027, 2026]);
    expect(seasons.current).toEqual({
      season: 2027,
      status: "upcoming",
      firstGameAt: Date.UTC(2027, 2, 17),
    });
  });

  it("stays on the old Season while its finals run, even with the next Fixture out", async () => {
    const seasons = await loadSeasons({
      ...fixture({
        2026: [done(2026, 100), todo(2026, DEC_2026 + 1)],
        2027: [todo(2027, Date.UTC(2027, 2, 17))],
      }),
      now: DEC_2026,
    });
    expect(seasons.current).toMatchObject({ season: 2026, status: "in-progress" });
  });

  it("is in progress mid-Season", async () => {
    const seasons = await loadSeasons({
      ...fixture({ 2026: [done(2026, 100), todo(2026, DEC_2026 + 1)] }),
      now: DEC_2026,
    });
    expect(seasons.current).toMatchObject({
      season: 2026,
      status: "in-progress",
      firstGameAt: 100,
    });
  });

  it("throws when Squiggle has no Games for this or last Season", async () => {
    await expect(loadSeasons({ ...fixture({}), now: DEC_2026 })).rejects.toThrow();
  });
});
