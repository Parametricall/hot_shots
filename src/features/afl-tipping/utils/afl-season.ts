import { FIRST_SEASON, TIPS_LANDING_LEAD_MS } from "~/features/afl-tipping/constants";
import type { AflGame, AflLeaderboardEntry } from "~/features/afl-tipping/types";

/**
 * The rules for which Season is current and who stands where in one. Pure, so the Demo runs the
 * same code as production (docs/adr/0004): nothing here may reach the service registry, the
 * session or Supabase.
 */

export type SeasonStatus = "upcoming" | "in-progress" | "over";

export type Seasons = {
  /** Newest first, from the Current Season down to `FIRST_SEASON`. */
  seasons: number[];
  current: { season: number; status: SeasonStatus; firstGameAt: number | null };
};

/** `upcoming` until a Game has started, `over` once every Game is complete. */
export function seasonStatus(games: AflGame[], now: number): SeasonStatus {
  if (games.length === 0) return "upcoming";
  if (games.every((game) => game.complete === 100)) return "over";
  if (games.some((game) => game.complete > 0 || game.unixTime <= now)) return "in-progress";
  return "upcoming";
}

/**
 * The Current Season: the earliest Season with a Game still to finish, so a Season stays current
 * through its finals even when the next Fixture is out (D2 of plan 014). `incompleteGames` is
 * every Game Squiggle hasn't marked complete; with none, the newest Season Squiggle has Games for.
 */
export function resolveCurrentSeason(args: {
  incompleteGames: AflGame[];
  latestSeasonWithGames: number;
}): number {
  const { incompleteGames, latestSeasonWithGames } = args;
  if (incompleteGames.length === 0) return latestSeasonWithGames;
  return Math.min(...incompleteGames.map((game) => game.season));
}

/** The Seasons to offer, newest first, for a Current Season. */
export function listSeasons(current: number): number[] {
  const seasons: number[] = [];
  for (let season = current; season >= FIRST_SEASON; season--) seasons.push(season);
  return seasons;
}

/**
 * Where `/afl-tipping` sends the user: My Tips while a Season is in progress or about to start, its
 * summary otherwise. An upcoming Season more than `TIPS_LANDING_LEAD_MS` from its first Game is in
 * the Pre-season, and lands on the summary: tipping is open, but nobody needs to be pushed to it
 * months out (docs/adr/0011).
 */
export function landingFor(
  current: Seasons["current"],
  now: number,
): { to: "tips"; season: number } | { to: "summary"; season: number } {
  return isTippingTime(current, now)
    ? { to: "tips", season: current.season }
    : { to: "summary", season: current.season };
}

function isTippingTime(current: Seasons["current"], now: number): boolean {
  if (current.status === "in-progress") return true;
  if (current.status === "over") return false;
  return current.firstGameAt !== null && current.firstGameAt - now <= TIPS_LANDING_LEAD_MS;
}

/**
 * Where picking `season` in the Season switcher goes: the Current Season lands as opening the App
 * would, and any other Season on its summary, since a past Season's result is what's worth seeing.
 */
export function landingForSeason(
  season: number,
  current: Seasons["current"],
  now: number,
): { to: "tips"; season: number } | { to: "summary"; season: number } {
  return season === current.season ? landingFor(current, now) : { to: "summary", season };
}

/** Each entry's rank in a Leaderboard already in order. Tipsters level on both measures share one. */
export function rankEntries(
  entries: Pick<AflLeaderboardEntry, "score" | "totalMarginDiff">[],
): number[] {
  const ranks: number[] = [];
  entries.forEach((current, i) => {
    const previous = entries[i - 1];
    if (
      previous &&
      current.score === previous.score &&
      current.totalMarginDiff === previous.totalMarginDiff
    ) {
      ranks.push(ranks[i - 1]!);
    } else {
      ranks.push(i + 1);
    }
  });
  return ranks;
}

/** Ranks 1 to 3, ties included, or [] before any Game is complete (everyone is level on nothing). */
export function podium(entries: AflLeaderboardEntry[]): AflLeaderboardEntry[] {
  if (entries.every((entry) => entry.score === 0 && entry.totalMarginDiff === 0)) return [];
  const ranks = rankEntries(entries);
  return entries.filter((_, i) => ranks[i]! <= 3);
}

/** Everyone on the last rank, or [] when the last rank is 3 or better (D4 of plan 014). */
export function woodenSpoon(entries: AflLeaderboardEntry[]): AflLeaderboardEntry[] {
  const ranks = rankEntries(entries);
  const lastRank = ranks.at(-1);
  if (lastRank === undefined || lastRank <= 3) return [];
  return entries.filter((_, i) => ranks[i] === lastRank);
}
