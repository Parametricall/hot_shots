import { describe, it, expect, vi } from "vite-plus/test";
import { QueryClient } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import { applyLiveGameUpdate, writeLiveGameUpdateToCache } from "./live-game-update";

// aflQueries reaches its services through the registry when query options are built.
vi.mock("~/app/service-registry", () => ({
  default: { getService: vi.fn().mockReturnValue({}) },
}));

const games = [
  createAflGame({ id: 1, round: 1, homeTeamId: 10, awayTeamId: 11 }),
  createAflGame({ id: 2, round: 1, homeTeamId: 20, awayTeamId: 21 }),
  createAflGame({ id: 3, round: 2, homeTeamId: 30, awayTeamId: 31 }),
];

describe("applyLiveGameUpdate", () => {
  it("changes only the matched Game and keeps every other Game's identity", () => {
    const result = applyLiveGameUpdate(games, {
      gameId: 2,
      homeScore: 30,
      awayScore: 12,
      timeStr: "Q2 10:00",
      complete: 40,
    });
    expect(result).not.toBe(games);
    expect(result[0]).toBe(games[0]);
    expect(result[2]).toBe(games[2]);
    expect(result[1]).toMatchObject({
      id: 2,
      homeScore: 30,
      awayScore: 12,
      timeStr: "Q2 10:00",
      complete: 40,
      homeTeamId: 20,
    });
  });

  it("keeps the updated Game's date instance", () => {
    const [, updated] = applyLiveGameUpdate(games, { gameId: 2, homeScore: 6 });
    expect(updated!.date).toBe(games[1]!.date);
    expect(updated!.date).toBeInstanceOf(Date);
  });

  it("returns the same array for a Game it does not have", () => {
    expect(applyLiveGameUpdate(games, { gameId: 99, homeScore: 6 })).toBe(games);
  });

  it("returns the same array when every field already has that value", () => {
    const live = [createAflGame({ id: 1, homeScore: 30, awayScore: 12, timeStr: "Q2  1:00" })];
    expect(applyLiveGameUpdate(live, { gameId: 1, homeScore: 30, timeStr: "Q2  1:00" })).toBe(live);
  });

  it("returns the same array for an update with no fields", () => {
    expect(applyLiveGameUpdate(games, { gameId: 1 })).toBe(games);
  });

  it("only touches the fields the update carries", () => {
    const live = [createAflGame({ id: 1, homeScore: 30, awayScore: 12 })];
    const [updated] = applyLiveGameUpdate(live, { gameId: 1, timeStr: "Q3  9:00" });
    expect(updated).toMatchObject({ homeScore: 30, awayScore: 12, timeStr: "Q3  9:00" });
  });

  describe("when the Game completes", () => {
    const base = createAflGame({ id: 1, homeTeamId: 10, awayTeamId: 11, complete: 90 });

    it("derives the winner from the scores: Home team", () => {
      const [g] = applyLiveGameUpdate([base], {
        gameId: 1,
        homeScore: 90,
        awayScore: 70,
        complete: 100,
      });
      expect(g).toMatchObject({ complete: 100, winnerTeamId: 10 });
    });

    it("derives the winner from the scores: Away team", () => {
      const [g] = applyLiveGameUpdate([base], {
        gameId: 1,
        homeScore: 60,
        awayScore: 70,
        complete: 100,
      });
      expect(g).toMatchObject({ winnerTeamId: 11 });
    });

    it("has no winner in a Draw", () => {
      const [g] = applyLiveGameUpdate([base], {
        gameId: 1,
        homeScore: 70,
        awayScore: 70,
        complete: 100,
      });
      expect(g).toMatchObject({ complete: 100, winnerTeamId: null });
    });

    it("uses scores the Game already had", () => {
      const scored = createAflGame({ ...base, homeScore: 80, awayScore: 50 });
      const [g] = applyLiveGameUpdate([scored], { gameId: 1, complete: 100 });
      expect(g).toMatchObject({ winnerTeamId: 10 });
    });

    it("keeps a winner the update names", () => {
      const [g] = applyLiveGameUpdate([base], {
        gameId: 1,
        homeScore: 60,
        awayScore: 70,
        complete: 100,
        winnerTeamId: 10,
      });
      expect(g).toMatchObject({ winnerTeamId: 10 });
    });

    it("is a no-op when the Game was already complete with that winner", () => {
      const done = [
        createAflGame({
          id: 1,
          homeTeamId: 10,
          awayTeamId: 11,
          homeScore: 90,
          awayScore: 70,
          complete: 100,
          winnerTeamId: 10,
        }),
      ];
      expect(applyLiveGameUpdate(done, { gameId: 1, complete: 100 })).toBe(done);
    });
  });
});

describe("writeLiveGameUpdateToCache", () => {
  function seed() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(aflQueries.allGames().queryKey, games);
    queryClient.setQueryData(aflQueries.games(1).queryKey, [games[0]!, games[1]!]);
    queryClient.setQueryData(aflQueries.incompleteGames().queryKey, games);
    return queryClient;
  }

  it("updates every cached list of Games", () => {
    const queryClient = seed();
    writeLiveGameUpdateToCache(queryClient, { gameId: 1, homeScore: 12 });

    const all = queryClient.getQueryData<typeof games>(aflQueries.allGames().queryKey)!;
    const round = queryClient.getQueryData<typeof games>(aflQueries.games(1).queryKey)!;
    const incomplete = queryClient.getQueryData<typeof games>(
      aflQueries.incompleteGames().queryKey,
    )!;
    expect(all[0]!.homeScore).toBe(12);
    expect(round[0]!.homeScore).toBe(12);
    expect(incomplete[0]!.homeScore).toBe(12);
    expect(all[0]!.date).toBe(games[0]!.date);
  });

  it("leaves other caches alone", () => {
    const queryClient = seed();
    const decoy = [{ id: 1, name: "Lions" }];
    queryClient.setQueryData(aflQueries.allTeamsKey(), decoy);
    queryClient.setQueryData([...aflQueries.aflKey(), "gameStats", { gameId: 1 }], decoy);

    writeLiveGameUpdateToCache(queryClient, { gameId: 1, homeScore: 12 });

    expect(queryClient.getQueryData(aflQueries.allTeamsKey())).toBe(decoy);
    expect(queryClient.getQueryData([...aflQueries.aflKey(), "gameStats", { gameId: 1 }])).toBe(
      decoy,
    );
  });

  it("skips a cache the update does not change", () => {
    const queryClient = seed();
    const round2 = [games[2]!];
    queryClient.setQueryData(aflQueries.games(2).queryKey, round2);

    writeLiveGameUpdateToCache(queryClient, { gameId: 1, homeScore: 12 });

    expect(queryClient.getQueryData(aflQueries.games(2).queryKey)).toBe(round2);
  });

  it("skips a cache that is not a list", () => {
    const queryClient = seed();
    queryClient.setQueryData([...aflQueries.allGamesKey(), "weird"], { not: "an array" });
    expect(() =>
      writeLiveGameUpdateToCache(queryClient, { gameId: 1, homeScore: 12 }),
    ).not.toThrow();
  });
});
