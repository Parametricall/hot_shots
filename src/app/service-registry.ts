import type { tipsRepository } from "~/features/afl-tipping/api/tips.repository";
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

/**
 * What callers use of each service, as named types rather than `typeof` the
 * real implementations. The real services call server functions, whose types
 * are not something another implementation can satisfy; the Demo
 * (docs/adr/0004) registers its own services in the same slots, and
 * `satisfies` checks them against these. Registering the real services in
 * `router.tsx` checks them against the same types.
 */
export type SquiggleService = {
  getAllCurrentTeams: () => Promise<AflTeam[]>;
  getStandings: () => Promise<AflStanding[]>;
  getGames: (round?: number) => Promise<AflGame[]>;
  getIncompleteGames: () => Promise<AflGame[]>;
  getModelTips: (round: number) => Promise<AflModelTip[]>;
};

export type AflService = {
  submitTip: (args: {
    data: { gameId: number; teamId: number; margin?: number };
  }) => Promise<{ success: boolean }>;
  getTips: (args: { data: { gameIds: number[] } }) => Promise<AflUserTip[]>;
  getLeaderboard: () => Promise<AflLeaderboardEntry[]>;
  getGroupTips: (args: { data: { round: number } }) => Promise<AflGroupTipEntry[]>;
  getPlayerStats: () => Promise<AflPlayerStatsEntry[]>;
};

export type ServiceTypes = {
  squiggleService: SquiggleService;
  aflService: AflService;
  tipsRepository: typeof tipsRepository;
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
