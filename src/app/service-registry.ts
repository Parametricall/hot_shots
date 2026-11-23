import type { LiveGameUpdate } from "~/features/afl-tipping/api/squiggle/sse-schemas";
import type { competitionEntriesRepository } from "~/features/afl-tipping/api/competition-entries.repository";
import type { tipsRepository } from "~/features/afl-tipping/api/tips.repository";
import type { tipstersRepository } from "~/features/afl-tipping/api/tipsters.repository";
import type {
  AflGame,
  AflGroupTipEntry,
  AflLeaderboardEntry,
  AflModelTip,
  AflPlayerStatsEntry,
  AflStanding,
  AflTeam,
  AflUserTip,
} from "~/features/afl-tipping/types";
import type { Seasons } from "~/features/afl-tipping/utils/afl-season";

/**
 * What callers use of each service, as named types rather than `typeof` the
 * real implementations. The real services call server functions, whose types
 * are not something another implementation can satisfy; the Demo
 * (docs/adr/0004) registers its own services in the same slots, and
 * `satisfies` checks them against these. Registering the real services in
 * `router.tsx` checks them against the same types.
 */
export type SquiggleService = {
  /** Teams have no Season: Squiggle lists the current 18. */
  getAllCurrentTeams: () => Promise<AflTeam[]>;
  getSeasons: () => Promise<Seasons>;
  getStandings: (season: number) => Promise<AflStanding[]>;
  getGames: (season: number, round?: number) => Promise<AflGame[]>;
  getModelTips: (season: number, round: number) => Promise<AflModelTip[]>;
};

export type AflService = {
  submitTip: (args: {
    data: { season: number; gameId: number; teamId: number; margin?: number };
  }) => Promise<{ success: boolean }>;
  getTips: (args: { data: { season: number; gameIds: number[] } }) => Promise<AflUserTip[]>;
  getLeaderboard: (args: { data: { season: number } }) => Promise<AflLeaderboardEntry[]>;
  getGroupTips: (args: { data: { season: number; round: number } }) => Promise<AflGroupTipEntry[]>;
  getPlayerStats: (args: { data: { season: number } }) => Promise<AflPlayerStatsEntry[]>;
};

export type LiveScoresSubscription = {
  onUpdate: (update: LiveGameUpdate) => void;
  /** The stream reconnected after an error, so updates may have been missed. */
  onResync: () => void;
};

/** Live Game updates from Squiggle's Event API. `subscribe` returns the unsubscribe function. */
export type LiveScoresService = {
  subscribe: (subscription: LiveScoresSubscription) => () => void;
};

export type ServiceTypes = {
  squiggleService: SquiggleService;
  aflService: AflService;
  liveScoresService: LiveScoresService;
  tipsRepository: typeof tipsRepository;
  tipstersRepository: typeof tipstersRepository;
  competitionEntriesRepository: typeof competitionEntriesRepository;
};

class ServiceRegistry {
  private services: Map<keyof ServiceTypes, ServiceTypes[keyof ServiceTypes]> = new Map();

  registerService<K extends keyof ServiceTypes>(serviceName: K, service: ServiceTypes[K]) {
    this.services.set(serviceName, service);
  }

  getService<K extends keyof ServiceTypes>(serviceName: K) {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service not found: ${serviceName}`);
    }
    return service as ServiceTypes[K];
  }

  clearServices() {
    this.services.clear();
  }
}

const serviceRegistry = new ServiceRegistry();
Object.freeze(serviceRegistry);
export default serviceRegistry;
