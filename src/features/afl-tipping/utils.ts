import { AflGame, AflRound } from "~/features/afl-tipping/types";

export function aflGamesToRounds(games: AflGame[]): AflRound[] {
  const rounds: Record<number, AflRound> = {};

  games.forEach((game) => {
    const roundId = game.round;
    if (!rounds[roundId]) {
      rounds[roundId] = {
        id: roundId,
        name: game.roundName,
        games: [],
      };
    }
    rounds[roundId].games.push(game);
  });

  return Object.values(rounds);
}
