import type { SquiggleService } from "~/app/service-registry";
import { now as siteNow } from "~/lib/clock";
import { gamesAsOf, standingsAsOf } from "./season-as-of";
import { DEMO_SEASON, loadSnapshot, type LoadSnapshotResult } from "./snapshot";
import { seasonStatus } from "~/features/afl-tipping/utils/afl-season";

/**
 * Squiggle as the Demo sees it (docs/adr/0004): the committed snapshot, shown
 * as it stood at the Demo clock. Same shape as `squiggleService`, so queries and
 * components don't know the difference.
 */

type Deps = {
  loadSnapshot: () => Promise<LoadSnapshotResult>;
  now: () => number;
};

/** The loaded snapshot, or a thrown error for the route's error boundary to show. */
export async function requireSnapshot(load: Deps["loadSnapshot"]) {
  const result = await load();
  if (!result.ok) {
    throw new Error(`The Demo snapshot failed to load (${result.reason}): ${result.detail}`);
  }
  return result.snapshot;
}

export function createSquiggleServiceDemo(
  deps: Deps = { loadSnapshot, now: siteNow },
): SquiggleService {
  const snapshot = () => requireSnapshot(deps.loadSnapshot);

  /** The Demo has one Season. Asked about any other, it has no Games. */
  const gamesFor = async (season: number) => {
    const { games } = await snapshot();
    return season === DEMO_SEASON ? gamesAsOf(games, deps.now()) : [];
  };

  return {
    getAllCurrentTeams: async () => (await snapshot()).teams,

    getSeasons: async () => {
      const games = await gamesFor(DEMO_SEASON);
      return {
        seasons: [DEMO_SEASON],
        current: {
          season: DEMO_SEASON,
          status: seasonStatus(games, deps.now()),
          firstGameAt: games.length > 0 ? Math.min(...games.map((g) => g.unixTime)) : null,
        },
      };
    },

    getStandings: async (season: number) => {
      if (season !== DEMO_SEASON) return [];
      const { standingsAfterRound, games } = await snapshot();
      return standingsAsOf({ standingsAfterRound }, games, deps.now());
    },

    getGames: async (season: number, round?: number) => {
      const masked = await gamesFor(season);
      return round === undefined ? masked : masked.filter((g) => g.round === round);
    },

    // The snapshot has each Game's last Model tip only (docs/adr/0004).
    getModelTips: async (season: number, round: number) => {
      if (season !== DEMO_SEASON) return [];
      const { modelTips } = await snapshot();
      return modelTips.filter((t) => t.round === round);
    },
  } satisfies SquiggleService;
}

export const squiggleServiceDemo = createSquiggleServiceDemo();
