import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import { podium, rankEntries, woodenSpoon } from "~/features/afl-tipping/utils/afl-season";

/**
 * Who is tipping in an upcoming Season, set against last Season's Leaderboard. Pure, so the Demo
 * runs the same code as production (docs/adr/0004).
 */

/** Someone who has entered this Season, with where they finished last Season. */
export type Entrant = {
  entry: AflLeaderboardEntry;
  /** Last Season's rank, or null if they weren't in last Season's Leaderboard. */
  lastRank: number | null;
  /** Whether another Tipster shared that rank. */
  lastRankIsTied: boolean;
};

/** Someone from last Season's Leaderboard, and whether they have entered this Season. */
export type PreviousTipster = {
  entry: AflLeaderboardEntry;
  rank: number;
  isBack: boolean;
};

export type PreSeason = {
  /** Whether there is a last Season's Leaderboard to compare with. */
  hasPrevious: boolean;
  /** This Season's entrants: by last Season's rank, then new Tipsters by name. */
  entrants: Entrant[];
  /** Last Season's rank-1 Tipster(s); [] if no Game was scored. */
  champions: PreviousTipster[];
  /** Last Season's Wooden spoon holder(s). */
  woodenSpoon: PreviousTipster[];
  /** Last Season's Tipsters who haven't entered this Season, in last Season's order. */
  notBack: PreviousTipster[];
};

/**
 * @param entrants this Season's Leaderboard (everyone who has entered)
 * @param previous last Season's final Leaderboard in order, or null when there was no last Season
 */
export function preSeason(
  entrants: AflLeaderboardEntry[],
  previous: AflLeaderboardEntry[] | null,
): PreSeason {
  const previousRanks = previous ? rankEntries(previous) : [];
  const entered = new Set(entrants.map((entry) => entry.userId));
  const lastSeason: PreviousTipster[] = (previous ?? []).map((entry, i) => ({
    entry,
    rank: previousRanks[i]!,
    isBack: entered.has(entry.userId),
  }));
  const byUser = new Map(lastSeason.map((tipster) => [tipster.entry.userId, tipster]));

  const rows: Entrant[] = entrants.map((entry) => {
    const last = byUser.get(entry.userId);
    return {
      entry,
      lastRank: last?.rank ?? null,
      lastRankIsTied: last ? lastSeason.filter((t) => t.rank === last.rank).length > 1 : false,
    };
  });
  rows.sort((a, b) => {
    if (a.lastRank !== b.lastRank) {
      if (a.lastRank === null) return 1;
      if (b.lastRank === null) return -1;
      return a.lastRank - b.lastRank;
    }
    return a.entry.displayName.localeCompare(b.entry.displayName, "en-AU");
  });

  const isScored = podium(previous ?? []).length > 0;
  const spoonIds = new Set((previous ? woodenSpoon(previous) : []).map((entry) => entry.userId));

  return {
    hasPrevious: previous !== null,
    entrants: rows,
    champions: isScored ? lastSeason.filter((t) => t.rank === 1) : [],
    woodenSpoon: lastSeason.filter((t) => spoonIds.has(t.entry.userId)),
    notBack: lastSeason.filter((t) => !t.isBack),
  };
}

const MELBOURNE_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Melbourne",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dayNumber(at: number): number {
  const [year, month, day] = MELBOURNE_DAY.format(at).split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / 86_400_000;
}

/** Calendar days (Melbourne) from `now` to `at`: 0 is today, 1 is tomorrow. */
export function daysUntil(at: number, now: number): number {
  return Math.max(0, dayNumber(at) - dayNumber(now));
}
