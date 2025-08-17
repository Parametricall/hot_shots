import { AflGame, AflRound, AflTeam } from "~/features/afl-tipping/types";

export function findAflTeamById(
  teams: AflTeam[],
  teamId: number,
): AflTeam | undefined {
  return teams.find((team) => team.id === teamId);
}

export function createUnknownAflTeam(id: AflTeam["id"]): AflTeam {
  return {
    id,
    name: "Unknown Team",
    abbrev: "UNK",
    logo: "/dummy-footy-logo.png",
    debut: 0,
  };
}

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
