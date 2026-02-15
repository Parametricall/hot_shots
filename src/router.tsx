import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultCatchBoundary } from "./components/DefaultCatchBoundary";
import { NotFound } from "./components/NotFound";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { QueryClient } from "@tanstack/react-query";
import serviceRegistry from "~/service-registry";
import { service as squiggleService } from "~/features/afl-tipping/api/squiggle.service";
import { service as aflService } from "~/features/afl-tipping/api/tips";
import { tipsRepository } from "~/features/afl-tipping/api/tips.repository";

serviceRegistry.registerService("squiggleService", squiggleService);
serviceRegistry.registerService("aflService", aflService);
serviceRegistry.registerService("tipsRepository", tipsRepository);

// QueryClient setup is taken from docs, but is experimental and will likely change
// https://tanstack.com/start/latest/docs/framework/react/examples/start-basic-react-query?path=examples%2Freact%2Fstart-basic-react-query%2Fsrc%2Frouter.tsx

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } }, // 1 minute
  });
  return routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      context: { queryClient },
      defaultPreload: "intent",
      defaultErrorComponent: DefaultCatchBoundary,
      defaultNotFoundComponent: () => <NotFound />,
      scrollRestoration: true,
    }),
    queryClient,
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
