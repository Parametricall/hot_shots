import { describe, it, expect } from "vitest";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflGame } from "~/features/afl-tipping/types";

// Import the extracted functions by re-exporting them for testing.
// Since they're module-private, we test them through the select behavior
// by reconstructing the same logic here. Alternatively, we directly test
// the functions since they're exported at module scope.

// We'll test the game stats logic by importing the module and checking the select result.
// The functions getPriorRounds, getTeamLast5, getH2hRecord, selectGameStats
// are not exported, so we test via the query's select function.

// To test properly, let's replicate the logic and test the data transforms.

function completedGame(overrides: Partial<AflGame> & { id: number; round: number }): AflGame {
  const pastTime = Date.now() - 1000 * 60 * 60 * 24;
  return createAflGame({
    complete: 100,
    unixTime: pastTime,
    date: new Date(pastTime),
    homeScore: 80,
    awayScore: 70,
    ...overrides,
  });
}

// We need to test selectGameStats. Let's import aflQueries and use the select function.
import { aflQueries } from "~/features/afl-tipping/api/queries";

describe("gameStats select", () => {
  // Extract the select function from the query options
  function selectGameStats(allGames: AflGame[], gameId: number) {
    const options = aflQueries.gameStats(gameId);
    return options.select!(allGames);
  }

  it("returns null when the game is not found", () => {
    expect(selectGameStats([], 999)).toBeNull();
  });

  it("returns empty last5 when there are no prior rounds", () => {
    const currentGame = createAflGame({ id: 1, round: 1, homeTeamId: 10, awayTeamId: 20 });
    const result = selectGameStats([currentGame], 1);
    expect(result).not.toBeNull();
    expect(result!.homeLast5).toEqual([]);
    expect(result!.awayLast5).toEqual([]);
  });

  it("computes last 5 form for both teams", () => {
    const currentGame = createAflGame({ id: 100, round: 6, homeTeamId: 1, awayTeamId: 2 });
    const priorGames = [
      completedGame({ id: 1, round: 1, homeTeamId: 1, awayTeamId: 3, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 2, homeTeamId: 1, awayTeamId: 4, winnerTeamId: 4 }),
      completedGame({ id: 3, round: 3, homeTeamId: 1, awayTeamId: 5, winnerTeamId: 1 }),
      completedGame({ id: 4, round: 1, homeTeamId: 2, awayTeamId: 6, winnerTeamId: 2 }),
      completedGame({ id: 5, round: 2, homeTeamId: 2, awayTeamId: 7, winnerTeamId: 7 }),
    ];
    const allGames = [...priorGames, currentGame];
    const result = selectGameStats(allGames, 100);

    // Prior rounds with games: 1, 2, 3 (only 3 distinct rounds exist before round 6)
    expect(result!.homeLast5).toHaveLength(3);
    expect(result!.homeLast5[0]!.result).toBe("win");
    expect(result!.homeLast5[1]!.result).toBe("loss");
    expect(result!.homeLast5[2]!.result).toBe("win");
  });

  it("computes head-to-head record", () => {
    const currentGame = createAflGame({ id: 100, round: 5, homeTeamId: 1, awayTeamId: 2 });
    const h2hGames = [
      completedGame({ id: 1, round: 1, homeTeamId: 1, awayTeamId: 2, winnerTeamId: 1 }),
      completedGame({ id: 2, round: 2, homeTeamId: 2, awayTeamId: 1, winnerTeamId: 1 }),
      completedGame({ id: 3, round: 3, homeTeamId: 1, awayTeamId: 2, winnerTeamId: null }),
    ];
    const allGames = [...h2hGames, currentGame];
    const result = selectGameStats(allGames, 100);

    expect(result!.h2h.homeWins).toBe(2);
    expect(result!.h2h.awayWins).toBe(0);
    expect(result!.h2h.draws).toBe(1);
    expect(result!.h2h.total).toBe(3);
  });

  it("limits last5 to 5 most recent rounds", () => {
    const currentGame = createAflGame({ id: 100, round: 10, homeTeamId: 1, awayTeamId: 2 });
    const priorGames = Array.from({ length: 8 }, (_, i) =>
      completedGame({
        id: i + 1,
        round: i + 1,
        homeTeamId: 1,
        awayTeamId: 3,
        winnerTeamId: 1,
      }),
    );
    const allGames = [...priorGames, currentGame];
    const result = selectGameStats(allGames, 100);

    // Should only include the 5 most recent prior rounds
    expect(result!.homeLast5).toHaveLength(5);
    expect(result!.homeLast5[0]!.round).toBe(4); // most recent 5: rounds 4-8
    expect(result!.homeLast5[4]!.round).toBe(8);
  });
});
