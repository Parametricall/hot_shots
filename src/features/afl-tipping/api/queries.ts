import { queryOptions } from "@tanstack/react-query";
import ServiceRegistry from "~/app/service-registry";
import { CACHE_DURATIONS } from "~/features/afl-tipping/constants";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";

// Lazy-initialize services to ensure they're registered before access
const getSquiggleService = () => ServiceRegistry.getService("squiggleService");
const getAflService = () => ServiceRegistry.getService("aflService");

/**
 * Every query below the Season has the Season in its key, under one prefix, so a whole Season can
 * be invalidated. Only the teams and the list of Seasons sit outside it.
 */
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
  seasonsKey: () => [...aflQueries.aflKey(), "seasons"] as const,
  seasons: () => {
    return queryOptions({
      queryKey: aflQueries.seasonsKey(),
      queryFn: () => getSquiggleService().getSeasons(),
      staleTime: CACHE_DURATIONS.GAMES,
    });
  },
  seasonKey: (season: number) => [...aflQueries.aflKey(), "season", season] as const,
  allStandingsKey: (season: number) => [...aflQueries.seasonKey(season), "standings"] as const,
  standings: (season: number) => {
    return queryOptions({
      queryKey: aflQueries.allStandingsKey(season),
      queryFn: () => getSquiggleService().getStandings(season),
      staleTime: CACHE_DURATIONS.STANDINGS,
    });
  },
  allGamesKey: (season: number) => [...aflQueries.seasonKey(season), "games"] as const,
  allGames: (season: number) => {
    return queryOptions({
      queryKey: aflQueries.allGamesKey(season),
      queryFn: () => getSquiggleService().getGames(season),
      staleTime: Infinity,
      // Scores change mid-round: bypass the Infinity staleTime when the app
      // regains focus so live results stay fresh
      refetchOnWindowFocus: "always",
    });
  },
  games: (season: number, round?: number) => {
    return queryOptions({
      queryKey: [...aflQueries.allGamesKey(season), { round }],
      queryFn: () => getSquiggleService().getGames(season, round),
      staleTime: CACHE_DURATIONS.GAMES,
    });
  },
  allModelTipsKey: (season: number) => [...aflQueries.seasonKey(season), "modelTips"] as const,
  modelTips: (season: number, round: number) => {
    return queryOptions({
      queryKey: [...aflQueries.allModelTipsKey(season), { round }],
      queryFn: () => getSquiggleService().getModelTips(season, round),
      staleTime: CACHE_DURATIONS.MODEL_TIPS,
    });
  },
  allGetTipsKey: (season: number) => [...aflQueries.seasonKey(season), "getTips"] as const,
  getTips: (season: number, gameIds: number[]) => {
    return queryOptions({
      queryKey: [...aflQueries.allGetTipsKey(season), { gameIds }],
      queryFn: () => getAflService().getTips({ data: { season, gameIds } }),
      staleTime: CACHE_DURATIONS.USER_TIPS,
    });
  },
  allGroupTipsKey: (season: number) => [...aflQueries.seasonKey(season), "groupTips"] as const,
  groupTips: (season: number, round: number) => {
    return queryOptions({
      queryKey: [...aflQueries.allGroupTipsKey(season), { round }],
      queryFn: () => getAflService().getGroupTips({ data: { season, round } }),
      staleTime: CACHE_DURATIONS.GROUP_TIPS,
    });
  },
  allLeaderboardKey: (season: number) => [...aflQueries.seasonKey(season), "leaderboard"] as const,
  leaderboard: (season: number) => {
    return queryOptions({
      queryKey: aflQueries.allLeaderboardKey(season),
      queryFn: () => getAflService().getLeaderboard({ data: { season } }),
      staleTime: CACHE_DURATIONS.LEADERBOARD,
    });
  },
  allPlayerStatsKey: (season: number) => [...aflQueries.seasonKey(season), "playerStats"] as const,
  playerStats: (season: number) => {
    return queryOptions({
      queryKey: aflQueries.allPlayerStatsKey(season),
      queryFn: () => getAflService().getPlayerStats({ data: { season } }),
      staleTime: CACHE_DURATIONS.LEADERBOARD,
    });
  },
  gameStats: (season: number, gameId: number) => {
    return queryOptions({
      queryKey: [...aflQueries.seasonKey(season), "gameStats", { gameId }],
      queryFn: () => getSquiggleService().getGames(season),
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
