import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "~/routeTree.gen";
import { DefaultCatchBoundary } from "~/components/DefaultCatchBoundary";
import { NotFound } from "~/components/NotFound";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import serviceRegistry from "~/app/service-registry";
import { service as squiggleService } from "~/features/afl-tipping/api/squiggle.service";
import { service as aflService } from "~/features/afl-tipping/api/tips";
import { tipsRepository } from "~/features/afl-tipping/api/tips.repository";

// The Demo registers its own services in getRouter. The condition is written out, not IS_DEMO:
// a constant imported from another module is not folded until after chunking, so Demo-only
// imports behind it would still ship in production.
if (import.meta.env.VITE_DEMO !== "true") {
  serviceRegistry.registerService("squiggleService", squiggleService);
  serviceRegistry.registerService("aflService", aflService);
  serviceRegistry.registerService("tipsRepository", tipsRepository);
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours

// QueryClient setup is taken from docs, but is experimental and will likely change
// https://tanstack.com/start/latest/docs/framework/react/examples/start-basic-react-query?path=examples%2Freact%2Fstart-basic-react-query%2Fsrc%2Frouter.tsx

export async function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        // gcTime must be >= the persistence maxAge, otherwise entries are
        // garbage-collected before they can be persisted/restored
        gcTime: PERSIST_MAX_AGE,
        refetchOnWindowFocus: true,
      },
    },
  });

  if (import.meta.env.VITE_DEMO === "true") {
    // The Demo registers its own services and keeps no query cache in the browser (docs/adr/0004).
    const { startDemo } = await import("~/features/afl-tipping/demo/start-demo");
    await startDemo();
  } else if (typeof window !== "undefined") {
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

    const [, restorePromise] = persistQueryClient({
      queryClient,
      persister,
      maxAge: PERSIST_MAX_AGE,
      buster: __BUILD_ID__,
    });

    // Wait for the restore so the first render sees cached data instead of
    // racing it with network fetches. Then mark everything except static team
    // data as stale: queries render instantly from cache and refetch in the
    // background on mount.
    // Note: all queries are persisted, including user-specific ones. Phones
    // here are single-user; if account switching ever matters, clear the
    // persister on Clerk sign-out.
    await restorePromise;
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[1] !== "teams",
    });
  }

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}
