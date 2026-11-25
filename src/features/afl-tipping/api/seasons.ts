import { FIRST_SEASON } from "~/features/afl-tipping/constants";
import type { AflGame } from "~/features/afl-tipping/types";
import {
  listSeasons,
  resolveCurrentSeason,
  seasonStatus,
  type Seasons,
} from "~/features/afl-tipping/utils/afl-season";

/** The year it is in Melbourne. The server runs in UTC, which is a day behind on 1 January. */
export function melbourneYear(at: number): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", year: "numeric" }).format(
      at,
    ),
  );
}

type Deps = {
  fetchIncompleteGames: (season: number) => Promise<AflGame[]>;
  fetchGames: (season: number) => Promise<AflGame[]>;
  now: number;
};

/**
 * Which Season is current, from our copy of Squiggle's Games (plan 015). Incomplete Games are asked
 * for per year, so this asks about last year (finals can run into the new year's planning), this
 * year and next year (the Fixture comes out in the off-season). With no Game left to finish
 * anywhere, the Current Season is the newest one we have Games for, so the app shows last Season's summary until the
 * next Fixture is out (D2 of plan 014).
 */
export async function loadSeasons(deps: Deps): Promise<Seasons> {
  const year = melbourneYear(deps.now);
  const candidates = [year - 1, year, year + 1].filter((season) => season >= FIRST_SEASON);

  const incompleteGames = (
    await Promise.all(candidates.map((season) => deps.fetchIncompleteGames(season)))
  ).flat();

  let current: number;
  let currentGames: AflGame[] | undefined;
  if (incompleteGames.length > 0) {
    current = resolveCurrentSeason({ incompleteGames, latestSeasonWithGames: year });
  } else {
    // Newest first: this year, then last year.
    let latest: number | undefined;
    for (const season of candidates.filter((s) => s <= year).toReversed()) {
      const games = await deps.fetchGames(season);
      if (games.length > 0) {
        latest = season;
        currentGames = games;
        break;
      }
    }
    if (latest === undefined) {
      throw new Error(
        "afl_games has no Games for this or last Season: the Squiggle sync hasn't filled it yet",
      );
    }
    current = resolveCurrentSeason({ incompleteGames, latestSeasonWithGames: latest });
  }

  currentGames ??= await deps.fetchGames(current);
  return {
    seasons: listSeasons(current),
    current: {
      season: current,
      status: seasonStatus(currentGames, deps.now),
      firstGameAt:
        currentGames.length > 0 ? Math.min(...currentGames.map((g) => g.unixTime)) : null,
    },
  };
}
