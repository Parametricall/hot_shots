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
import { service as featureFlagsService } from "~/features/afl-tipping/api/feature-flags";
import { service as cheatingReportsService } from "~/features/afl-tipping/api/cheating-reports";
import { tipsRepository } from "~/features/afl-tipping/api/tips.repository";
import { cheatingReportsRepository } from "~/features/afl-tipping/api/cheating-reports.repository";
import { featureFlagsRepository } from "~/features/afl-tipping/api/feature-flags.repository";

serviceRegistry.registerService("squiggleService", squiggleService);
serviceRegistry.registerService("aflService", aflService);
serviceRegistry.registerService("featureFlagsService", featureFlagsService);
serviceRegistry.registerService("cheatingReportsService", cheatingReportsService);
serviceRegistry.registerService("tipsRepository", tipsRepository);
serviceRegistry.registerService("cheatingReportsRepository", cheatingReportsRepository);
serviceRegistry.registerService("featureFlagsRepository", featureFlagsRepository);

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
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}
