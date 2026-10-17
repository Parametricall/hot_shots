import { now } from "~/lib/clock";
import type { AflGame } from "../types";

export type { AflGame as Type } from "../types";

export const hasStarted = (game: AflGame, at: number = now()) => at >= game.unixTime;

export const isComplete = (game: AflGame): boolean => game.complete === 100;

export function byId(id: AflGame["id"] | undefined) {
  return (game: AflGame) => game.id === id;
}

export function byRound(round: AflGame["round"]) {
  return (game: AflGame) => game.round === round;
}

export function sortByDate(games: AflGame[]) {
  return games.toSorted((a, b) => a.date.getTime() - b.date.getTime());
}

export const getActiveRound = (games: AflGame[]): number => {
  const incompleteGames = games.filter((game) => !isComplete(game));
  if (incompleteGames.length === 0) {
    return 0;
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
