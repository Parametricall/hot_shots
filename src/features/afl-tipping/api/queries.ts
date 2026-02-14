import { queryOptions } from "@tanstack/react-query";
import ServiceRegistry from "~/service-registry";
import { CACHE_DURATIONS } from "~/features/afl-tipping/constants";
import { AflGame } from "~/features/afl-tipping/types";

// Lazy-initialize services to ensure they're registered before access
const getSquiggleService = () => ServiceRegistry.getService("squiggleService");
const getAflService = () => ServiceRegistry.getService("aflService");

export const aflQueries = {
  aflKey: () => ["afl"] as const,
  allTeamsKey: () => [...aflQueries.aflKey(), "teams"] as const,
  teams: () => {
    return queryOptions({
      queryKey: aflQueries.allTeamsKey(),
      queryFn: getSquiggleService().getAllCurrentTeams,
      staleTime: Infinity, // Teams rarely change, so we can cache them indefinitely
    });
  },
  allStandingsKey: () => [...aflQueries.aflKey(), "standings"] as const,
  standings: () => {
    return queryOptions({
      queryKey: aflQueries.allStandingsKey(),
      queryFn: getSquiggleService().getStandings,
      staleTime: CACHE_DURATIONS.STANDINGS,
    });
  },
  allGamesKey: () => [...aflQueries.aflKey(), "games"] as const,
  allGames: () => {
    return queryOptions({
      queryKey: aflQueries.allGamesKey(),
      queryFn: () => getSquiggleService().getGames(),
      staleTime: Infinity,
    });
  },
  games: (round?: number) => {
    return queryOptions({
      queryKey: [...aflQueries.allGamesKey(), { round }],
      queryFn: () => getSquiggleService().getGames(round),
      staleTime: CACHE_DURATIONS.GAMES,
    });
  },
  allIncompleteGamesKey: () => [...aflQueries.allGamesKey(), "incompleteGames"] as const,
  incompleteGames: () => {
    return queryOptions({
      queryKey: [...aflQueries.allIncompleteGamesKey()],
      queryFn: getSquiggleService().getIncompleteGames,
      staleTime: CACHE_DURATIONS.INCOMPLETE_GAMES,
    });
  },
  allModelTipsKey: () => [...aflQueries.aflKey(), "modelTips"],
  modelTips: (round: number) => {
    return queryOptions({
      queryKey: [...aflQueries.allModelTipsKey(), { round }],
      queryFn: () => getSquiggleService().getModelTips(round),
      staleTime: CACHE_DURATIONS.MODEL_TIPS,
    });
  },
  getTips: (gameIds: number[]) => {
    return queryOptions({
      queryKey: [...aflQueries.aflKey(), "getTips", { gameIds }],
      queryFn: () => getAflService().getTips({ data: { gameIds } }),
      staleTime: CACHE_DURATIONS.USER_TIPS,
    });
  },
  allLeaderboardKey: () => [...aflQueries.aflKey(), "leaderboard"] as const,
  leaderboard: () => {
    return queryOptions({
      queryKey: aflQueries.allLeaderboardKey(),
      queryFn: () => getAflService().getLeaderboard(),
      staleTime: CACHE_DURATIONS.LEADERBOARD,
    });
  },
  gameStats: (gameId: number) => {
    return queryOptions({
      queryKey: [...aflQueries.aflKey(), "gameStats", { gameId }],
      queryFn: () => getSquiggleService().getGames(),
      staleTime: Infinity,
      select: (allGames) => {
        const thisGame = allGames.find((g) => g.id === gameId);
        if (!thisGame) return null;

        const { homeTeamId, awayTeamId, round } = thisGame;

        const completedBefore = allGames.filter((g) => AflGame.isComplete(g) && g.round < round);

        const getLast5 = (
          teamId: number | null,
        ): { round: number; result: "win" | "loss" | "draw" | "bye" }[] => {
          if (!teamId) return [];
          const recentRounds = Array.from(
            { length: Math.min(5, round - 1) },
            (_, i) => round - 1 - i,
          ).reverse();
          return recentRounds.map((r) => {
            const game = completedBefore.find(
              (g) => g.round === r && (g.homeTeamId === teamId || g.awayTeamId === teamId),
            );
            if (!game) return { round: r, result: "bye" as const };
            if (game.winnerTeamId === null) return { round: r, result: "draw" as const };
            return {
              round: r,
              result: game.winnerTeamId === teamId ? ("win" as const) : ("loss" as const),
            };
          });
        };

        const h2hGames = completedBefore.filter(
          (g) =>
            (g.homeTeamId === homeTeamId && g.awayTeamId === awayTeamId) ||
            (g.homeTeamId === awayTeamId && g.awayTeamId === homeTeamId),
        );

        const homeH2hWins = h2hGames.filter((g) => g.winnerTeamId === homeTeamId).length;
        const awayH2hWins = h2hGames.filter((g) => g.winnerTeamId === awayTeamId).length;
        const draws = h2hGames.filter((g) => g.winnerTeamId === null).length;

        return {
          homeLast5: getLast5(homeTeamId),
          awayLast5: getLast5(awayTeamId),
          h2h: { homeWins: homeH2hWins, awayWins: awayH2hWins, draws, total: h2hGames.length },
        };
      },
    });
  },
};
