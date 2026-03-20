import { AflGame, AflRound, AflTeam } from "~/features/afl-tipping/types";
import { UNKNOWN_TEAM_ABBREV } from "~/features/afl-tipping/constants";

export function findAflTeamById(teams: AflTeam[], teamId: number): AflTeam | undefined {
  return teams.find((team) => team.id === teamId);
}

export function createUnknownAflTeam(id: AflTeam["id"]): AflTeam {
  return {
    id,
    name: "Unknown Team",
    abbrev: UNKNOWN_TEAM_ABBREV,
    logo: "/dummy-footy-logo.png",
    debut: 0,
  };
}

export function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function groupGamesByDate(games: AflGame[]): Record<string, AflGame[]> {
  return games.reduce(
    (acc, item) => {
      const key = item.date.toISOString().split("T")[0];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, AflGame[]>,
  );
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "numeric",
  });
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
