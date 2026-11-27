import {
  LIVE_POST_START_WINDOW_MS,
  LIVE_PRE_GAME_WINDOW_MS,
} from "~/features/afl-tipping/constants";
import { now } from "~/lib/clock";
import type { AflGame } from "../types";

export type { AflGame as Type } from "../types";

export const hasStarted = (game: AflGame, at: number = now()) => at >= game.unixTime;

export const isComplete = (game: AflGame): boolean => game.complete === 100;

export const isLive = (game: AflGame, at: number = now()) =>
  hasStarted(game, at) && !isComplete(game);

/**
 * Whether live scores could arrive for the Game: it is incomplete and starts within the pre-game
 * window, or started less than the post-start window ago.
 */
export const isLiveOrImminent = (game: AflGame, at: number = now()) =>
  !isComplete(game) &&
  game.unixTime - at <= LIVE_PRE_GAME_WINDOW_MS &&
  at - game.unixTime <= LIVE_POST_START_WINDOW_MS;

export function byId(id: AflGame["id"] | undefined) {
  return (game: AflGame) => game.id === id;
}

export function byRound(round: AflGame["round"]) {
  return (game: AflGame) => game.round === round;
}

export function sortByDate(games: AflGame[]) {
  return games.toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * The Current Round: the first Round with a Game still to finish. Once every Game is done it is
 * the Season's last Round, which every Season has (not Round 0, which 2027 doesn't). 0 with no
 * Games at all.
 */
export const getActiveRound = (games: AflGame[]): number => {
  if (games.length === 0) return 0;

  const incompleteGames = games.filter((game) => !isComplete(game));
  if (incompleteGames.length === 0) {
    return Math.max(...games.map((g) => g.round));
  }

  return Math.min(...incompleteGames.map((g) => g.round));
};

export function getFirstGameOfRound(games: AflGame[]): AflGame | undefined {
  if (games.length === 0) return undefined;
  return games.reduce((earliest, game) => (game.unixTime < earliest.unixTime ? game : earliest));
}

export function groupByRound(games: AflGame[]): Record<number, AflGame[]> {
  return games.reduce(
    (acc, game) => {
      const bucket = acc[game.round] ?? [];
      bucket.push(game);
      acc[game.round] = bucket;
      return acc;
    },
    {} as Record<number, AflGame[]>,
  );
}
