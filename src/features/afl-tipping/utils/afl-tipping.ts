import type { AflGame, AflRound, AflTeam } from "../types";
import { UNKNOWN_TEAM_ABBREV } from "../constants";

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
      const key = item.date.toISOString().split("T")[0]!;
      const bucket = acc[key] ?? [];
      bucket.push(item);
      acc[key] = bucket;
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
    const round = rounds[roundId] ?? { id: roundId, name: game.roundName, games: [] };
    round.games.push(game);
    rounds[roundId] = round;
  });

  return Object.values(rounds);
}
