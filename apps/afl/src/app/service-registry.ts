import type { service as squiggleService } from "~/features/afl-tipping/api/squiggle.service";
import type { service as aflService } from "~/features/afl-tipping/api/tips";
import type { service as featureFlagsService } from "~/features/afl-tipping/api/feature-flags";
import type { service as cheatingReportsService } from "~/features/afl-tipping/api/cheating-reports";
import type { tipsRepository } from "~/features/afl-tipping/api/tips.repository";
import type { cheatingReportsRepository } from "~/features/afl-tipping/api/cheating-reports.repository";
import type { featureFlagsRepository } from "~/features/afl-tipping/api/feature-flags.repository";

export interface ServiceTypes {
  squiggleService: typeof squiggleService;
  aflService: typeof aflService;
  featureFlagsService: typeof featureFlagsService;
  cheatingReportsService: typeof cheatingReportsService;
  tipsRepository: typeof tipsRepository;
  cheatingReportsRepository: typeof cheatingReportsRepository;
  featureFlagsRepository: typeof featureFlagsRepository;
}

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
