import type { service as squiggleService } from "~/features/afl-tipping/api/squiggle.service";
import type { service as aflService } from "~/features/afl-tipping/api/tips";

export interface ServiceTypes {
  squiggleService: typeof squiggleService;
  aflService: typeof aflService;
}

class ServiceRegistry {
  private services: Map<keyof ServiceTypes, ServiceTypes[keyof ServiceTypes]> =
    new Map();

  registerService<K extends keyof ServiceTypes>(
    serviceName: K,
    service: ServiceTypes[K],
  ) {
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
