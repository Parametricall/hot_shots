import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "~/routeTree.gen";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import serviceRegistry from "~/app/service-registry";
import { service as squiggleService } from "~/features/afl-tipping/api/squiggle.service";
import { service as aflService } from "~/features/afl-tipping/api/tips";
import { tipsRepository } from "~/features/afl-tipping/api/tips.repository";

serviceRegistry.registerService("squiggleService", squiggleService);
serviceRegistry.registerService("aflService", aflService);
serviceRegistry.registerService("tipsRepository", tipsRepository);

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// QueryClient setup is taken from docs, but is experimental and will likely change
// https://tanstack.com/start/latest/docs/framework/react/examples/start-basic-react-query?path=examples%2Freact%2Fstart-basic-react-query%2Fsrc%2Frouter.tsx

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000 } }, // 1 minute
  });

  if (typeof window !== "undefined") {
    const persister = createAsyncStoragePersister({
      storage: window.localStorage,
      deserialize: (data) =>
        JSON.parse(data, (_key, value) => {
          if (typeof value === "string" && ISO_DATE_REGEX.test(value)) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) return date;
          }
          return value;
        }),
    });

    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    });
  }

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
