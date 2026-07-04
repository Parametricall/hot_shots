import { queryOptions } from "@tanstack/react-query";
import ServiceRegistry from "~/app/service-registry";
import { CACHE_DURATIONS } from "~/features/afl-tipping/constants";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";

// Lazy-initialize services to ensure they're registered before access
const getSquiggleService = () => ServiceRegistry.getService("squiggleService");
const getAflService = () => ServiceRegistry.getService("aflService");
const getFeatureFlagService = () => ServiceRegistry.getService("featureFlagsService");
const getCheatingReportsService = () => ServiceRegistry.getService("cheatingReportsService");

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
  allGetTipsKey: () => [...aflQueries.aflKey(), "getTips"] as const,
  getTips: (gameIds: number[]) => {
    return queryOptions({
      queryKey: [...aflQueries.allGetTipsKey(), { gameIds }],
      queryFn: () => getAflService().getTips({ data: { gameIds } }),
      staleTime: CACHE_DURATIONS.USER_TIPS,
    });
  },
  allGroupTipsKey: () => [...aflQueries.aflKey(), "groupTips"] as const,
  groupTips: (round: number) => {
    return queryOptions({
      queryKey: [...aflQueries.allGroupTipsKey(), { round }],
      queryFn: () => getAflService().getGroupTips({ data: { round } }),
      staleTime: CACHE_DURATIONS.GROUP_TIPS,
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
  allPlayerStatsKey: () => [...aflQueries.aflKey(), "playerStats"] as const,
  playerStats: () => {
    return queryOptions({
      queryKey: aflQueries.allPlayerStatsKey(),
      queryFn: () => getAflService().getPlayerStats(),
      staleTime: CACHE_DURATIONS.LEADERBOARD,
    });
  },
  cheatingReports: () => {
    return queryOptions({
      queryKey: [...aflQueries.aflKey(), "cheatingReports"],
      queryFn: () => getCheatingReportsService().checkCheatingReports(),
    });
  },
  featureFlag: (key: string) => {
    return queryOptions({
      queryKey: [...aflQueries.aflKey(), "featureFlag", key],
      queryFn: () => getFeatureFlagService().getFeatureFlag({ data: { key } }),
    });
  },
  gameStats: (gameId: number) => {
    return queryOptions({
      queryKey: [...aflQueries.aflKey(), "gameStats", { gameId }],
      queryFn: () => getSquiggleService().getGames(),
      staleTime: Infinity,
      select: (allGames) => selectGameStats(allGames, gameId),
    });
  },
};

type FormResult = { round: number; result: "win" | "loss" | "draw" | "bye" };

function getPriorRounds(allGames: AflGame.Type[], beforeRound: number): number[] {
  return [...new Set(allGames.filter((g) => g.round < beforeRound).map((g) => g.round))]
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reverse();
}

function getTeamLast5(
  teamId: number | null,
  priorRounds: number[],
  completedBefore: AflGame.Type[],
): FormResult[] {
  if (!teamId) return [];
  return priorRounds.map((r) => {
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
}

function getH2hRecord(
  completedBefore: AflGame.Type[],
  homeTeamId: number | null,
  awayTeamId: number | null,
) {
  const h2hGames = completedBefore.filter(
    (g) =>
      (g.homeTeamId === homeTeamId && g.awayTeamId === awayTeamId) ||
      (g.homeTeamId === awayTeamId && g.awayTeamId === homeTeamId),
  );

  return {
    homeWins: h2hGames.filter((g) => g.winnerTeamId === homeTeamId).length,
    awayWins: h2hGames.filter((g) => g.winnerTeamId === awayTeamId).length,
    draws: h2hGames.filter((g) => g.winnerTeamId === null).length,
    total: h2hGames.length,
  };
}

function selectGameStats(allGames: AflGame.Type[], gameId: number) {
  const thisGame = allGames.find((g) => g.id === gameId);
  if (!thisGame) return null;

  const { homeTeamId, awayTeamId, round } = thisGame;
  const completedBefore = allGames.filter((g) => AflGame.isComplete(g) && g.round < round);
  const priorRounds = getPriorRounds(allGames, round);

  return {
    homeLast5: getTeamLast5(homeTeamId, priorRounds, completedBefore),
    awayLast5: getTeamLast5(awayTeamId, priorRounds, completedBefore),
    h2h: getH2hRecord(completedBefore, homeTeamId, awayTeamId),
  };
}
