import { queryOptions } from "@tanstack/react-query";
import {
  fetchAllCurrentTeams,
  fetchStandings,
} from "~/features/afl-tipping/api/squiggle/api";

export const aflQueries = {
  all: () => ["afl"] as const,
  allTeams: () => [...aflQueries.all(), "teams"] as const,
  teams: () =>
    queryOptions({
      queryKey: aflQueries.allTeams(),
      queryFn: fetchAllCurrentTeams,
      staleTime: Infinity, // Teams rarely change, so we can cache them indefinitely
    }),
  allStandings: () => [...aflQueries.all(), "standings"] as const,
  standings: () =>
    queryOptions({
      queryKey: aflQueries.allStandings(),
      queryFn: fetchStandings,
      staleTime: 1000 * 60 * 60, // Cache standings for 1 hour
    }),
};
