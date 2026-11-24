import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { AflGame } from "~/features/afl-tipping/types";

/**
 * The Tipster's Tips on every Game of the Season, for what spans Rounds: the Round chips' dots.
 * It shares the cache's `getTips` prefix, so tipping a Game updates it, like the Round's own query.
 */
export function useSeasonTips(season: number, games: AflGame[]) {
  const gameIds = useMemo(() => games.map((game) => game.id), [games]);
  return useQuery({
    ...aflQueries.getTips(season, gameIds),
    enabled: gameIds.length > 0,
  });
}
