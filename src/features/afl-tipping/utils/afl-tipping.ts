import type { AflGame, AflModelTip, AflRound, AflTeam, AflUserTip } from "../types";
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

/**
 * A `groupGamesByDate` key ("2025-04-05") as a heading: "Saturday 5 April 2025". The key is
 * already a day in the viewer's zone, so it is formatted as is, in UTC, where it parses.
 */
export function formatDateHeader(dateKey: string): string {
  return new Date(dateKey).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Games by the day they start on in `timeZone`, keyed "2025-04-05". */
export function groupGamesByDate(games: AflGame[], timeZone: string): Record<string, AflGame[]> {
  // en-CA writes dates as YYYY-MM-DD.
  const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone });
  return games.reduce(
    (acc, item) => {
      const key = dayFormat.format(item.date);
      const bucket = acc[key] ?? [];
      bucket.push(item);
      acc[key] = bucket;
      return acc;
    },
    {} as Record<string, AflGame[]>,
  );
}

/** A Game's start time in `timeZone`: "7:30 pm". */
export function formatTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "numeric",
    timeZone,
  });
}

export type TipSnapshotStatus = "favourite" | "underdog";

export function getTipSnapshotMismatch(
  tip: AflUserTip | undefined,
  prediction: AflModelTip | undefined,
): TipSnapshotStatus | null {
  if (tip == null) return null;
  if (tip.isUnderdog == null) return null;
  if (prediction == null || prediction.tipTeamId == null) return null;

  const liveIsUnderdog = tip.tipTeamId !== prediction.tipTeamId;
  if (tip.isUnderdog === liveIsUnderdog) return null;

  return tip.isUnderdog ? "underdog" : "favourite";
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
