import type { QueryClient } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { LiveGameUpdate } from "~/features/afl-tipping/api/squiggle/sse-schemas";
import type { AflGame } from "~/features/afl-tipping/types";

const LIVE_FIELDS = ["homeScore", "awayScore", "timeStr", "complete", "winnerTeamId"] as const;

/** Who won, from the final scores: the Home team, the Away team, or nobody in a Draw. */
function winnerFromScores(game: AflGame): number | null {
  if (game.homeScore == null || game.awayScore == null) return null;
  if (game.homeScore > game.awayScore) return game.homeTeamId;
  if (game.awayScore > game.homeScore) return game.awayTeamId;
  return null;
}

/**
 * The Games with one live update applied. Pure.
 *
 * Returns the same array when nothing changes (the Game is not in it, or every
 * field in the update already has that value), so queries and memos keep their
 * identity. Otherwise only the matched Game is replaced; every other Game keeps
 * its identity, and the replaced one keeps its `date` instance, because only the
 * five live fields are ever written.
 *
 * An update that lands `complete: 100` without a winner gets one from the scores.
 */
export function applyLiveGameUpdate(games: AflGame[], update: LiveGameUpdate): AflGame[] {
  const index = games.findIndex((g) => g.id === update.gameId);
  if (index === -1) return games;
  const game = games[index]!;

  const changes: Partial<Pick<AflGame, (typeof LIVE_FIELDS)[number]>> = {};
  for (const field of LIVE_FIELDS) {
    const value = update[field];
    if (value !== undefined && value !== game[field]) {
      Object.assign(changes, { [field]: value });
    }
  }

  if (update.complete === 100 && update.winnerTeamId === undefined) {
    const winnerTeamId = winnerFromScores({ ...game, ...changes });
    if (winnerTeamId !== game.winnerTeamId) changes.winnerTeamId = winnerTeamId;
  }

  if (Object.keys(changes).length === 0) return games;
  return games.map((g, i) => (i === index ? { ...g, ...changes } : g));
}

/**
 * Writes one live update into every cached list of Games: the whole Season, each
 * Round and the incomplete Games all sit under `["afl", "games"]`. Caches the
 * update does not change are left alone. `gameStats` is under another key and
 * recomputes from the Games with `select`, so it needs nothing.
 */
export function writeLiveGameUpdateToCache(queryClient: QueryClient, update: LiveGameUpdate): void {
  const cached = queryClient.getQueriesData<AflGame[]>({ queryKey: aflQueries.allGamesKey() });
  for (const [queryKey, games] of cached) {
    if (!Array.isArray(games)) continue;
    const updated = applyLiveGameUpdate(games, update);
    if (updated !== games) queryClient.setQueryData(queryKey, updated);
  }
}
