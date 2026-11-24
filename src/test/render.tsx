import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

export function renderWithClient(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
): RenderResult & { queryClient: QueryClient } {
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

/**
 * Renders `ui` at `/afl-tipping/<season>/<tab>` in a router that knows the AFL Tipping paths, so
 * a `Link` renders and a click lands somewhere. The router is returned to read where it went.
 */
export async function renderInSeasonRouter(
  ui: ReactElement,
  { path = "/afl-tipping/2026", queryClient = createTestQueryClient() } = {},
) {
  const rootRoute = createRootRoute({ component: () => ui });
  const tabs = ["", "/tips", "/group-tips", "/leaderboard", "/standings", "/stats"].map((tab) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path: `/afl-tipping/$season${tab}`,
      validateSearch: (search: Record<string, unknown>) => search,
    }),
  );
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree: rootRoute.addChildren(tabs),
  });
  await router.load();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
