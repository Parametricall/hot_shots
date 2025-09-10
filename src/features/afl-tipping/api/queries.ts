import { queryOptions } from "@tanstack/react-query";
import {
  fetchAllCurrentTeams,
  fetchGames,
  fetchIncompleteGames,
  fetchStandings,
  fetchTips,
} from "~/features/afl-tipping/api/squiggle/api";

export const aflQueries = {
  aflKey: () => ["afl"] as const,
  allTeamsKey: () => [...aflQueries.aflKey(), "teams"] as const,
  teams: () =>
    queryOptions({
      queryKey: aflQueries.allTeamsKey(),
      queryFn: fetchAllCurrentTeams,
      staleTime: Infinity, // Teams rarely change, so we can cache them indefinitely
    }),
  allStandingsKey: () => [...aflQueries.aflKey(), "standings"] as const,
  standings: () =>
    queryOptions({
      queryKey: aflQueries.allStandingsKey(),
      queryFn: fetchStandings,
      staleTime: 1000 * 60 * 60, // Cache standings for 1 hour
    }),
  allGamesKey: () => [...aflQueries.aflKey(), "games"] as const,
  allGames: () =>
    queryOptions({
      queryKey: aflQueries.allGamesKey(),
      queryFn: () => fetchGames(),
      staleTime: Infinity,
    }),
  games: (round?: number) =>
    queryOptions({
      queryKey: [...aflQueries.allGamesKey(), { round }],
      queryFn: () => fetchGames(round),
      staleTime: 1000 * 60 * 5, // Cache games for 5 minutes
    }),
  allIncompleteGamesKey: () =>
    [...aflQueries.allGamesKey(), "incompleteGames"] as const,
  incompleteGames: () =>
    queryOptions({
      queryKey: [...aflQueries.allIncompleteGamesKey()],
      queryFn: () => fetchIncompleteGames(),
      staleTime: 1000 * 60, // Cache incomplete games for 1 hour
    }),
  allTipsKey: () => [...aflQueries.aflKey(), "tips"],
  tips: (round: number) =>
    queryOptions({
      queryKey: [...aflQueries.allTipsKey(), { round }],
      queryFn: () => fetchTips(round),
      staleTime: 1000 * 60 * 60, // Cache tips for 1 hour
    }),
};
