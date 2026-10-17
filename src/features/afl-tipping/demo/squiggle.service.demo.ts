import type { SquiggleService } from "~/app/service-registry";
import { now as siteNow } from "~/lib/clock";
import { gamesAsOf, standingsAsOf } from "./season-as-of";
import { loadSnapshot, type LoadSnapshotResult } from "./snapshot";

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

  return {
    getAllCurrentTeams: async () => (await snapshot()).teams,

    getStandings: async () => {
      const { standingsAfterRound, games } = await snapshot();
      return standingsAsOf({ standingsAfterRound }, games, deps.now());
    },

    getGames: async (round?: number) => {
      const { games } = await snapshot();
      const masked = gamesAsOf(games, deps.now());
      return round === undefined ? masked : masked.filter((g) => g.round === round);
    },

    getIncompleteGames: async () => {
      const { games } = await snapshot();
      return gamesAsOf(games, deps.now())
        .filter((g) => g.complete !== 100)
        .toSorted((a, b) => a.unixTime - b.unixTime);
    },

    // The snapshot has each Game's last Model tip only (docs/adr/0004).
    getModelTips: async (round: number) => {
      const { modelTips } = await snapshot();
      return modelTips.filter((t) => t.round === round);
    },
  } satisfies SquiggleService;
}

export const squiggleServiceDemo = createSquiggleServiceDemo();
