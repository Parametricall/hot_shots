import type { AflGame } from "../types";

export type { AflGame as Type } from "../types";

export const hasStarted = (game: AflGame) => Date.now() >= game.unixTime;

export const isComplete = (game: AflGame): boolean => game.complete === 100;

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
      if (!acc[game.round]) {
        acc[game.round] = [];
      }
      acc[game.round].push(game);
      return acc;
    },
    {} as Record<number, AflGame[]>,
  );
}
