// Freeze Date.now so stories relying on it (factories, useGameStartTimer) render
// deterministically in Chromatic. Must run before story modules evaluate.
const FROZEN_NOW = new Date("2026-04-20T10:00:00+10:00").getTime();
Date.now = () => FROZEN_NOW;

import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import type { Decorator } from "@storybook/react-vite";
import { definePreview } from "@storybook/react-vite";
import { HTMLProps, Suspense, useState } from "react";
import { cn } from "~/lib/utils";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import ServiceRegistry, { ServiceTypes } from "~/app/service-registry";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { currentUserQueryKey } from "~/features/auth/queries";
import type { CurrentUser } from "~/features/auth/use-current-user";

import "~/styles/app.css";

export const containerDecorator = (className: HTMLProps<HTMLElement>["className"]) => {
  const Decorated: Decorator = (Story) => (
    <div className={cn("w-full", className)}>
      <Story />
    </div>
  );
  return Decorated;
};

export const centeredYDecorator: Decorator = (Story) => {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <Story />
    </div>
  );
};

export const withSuspense: Decorator = (Story) => (
  <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
    <Story />
  </Suspense>
);

export type StoryServices = {
  [K in keyof ServiceTypes]?: Partial<ServiceTypes[K]>;
};

export const withQueryAndServices: Decorator = function WithQueryAndServices(Story, context) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000, retry: false } } }),
  );

  ServiceRegistry.clearServices();
  const services = (context.parameters.services ?? {}) as StoryServices;
  for (const key of Object.keys(services) as (keyof StoryServices)[]) {
    const service = services[key];
    if (service) {
      ServiceRegistry.registerService(key, service as ServiceTypes[typeof key]);
    }
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Story />
    </QueryClientProvider>
  );
};

export const withRouter: Decorator = function WithRouter(Story) {
  const [router] = useState(() => {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => <Story />,
    });
    return createRouter({
      history: createMemoryHistory({ initialEntries: ["/"] }),
      routeTree: rootRoute.addChildren([indexRoute]),
    });
  });

  return <RouterProvider router={router} />;
};

export const DEFAULT_USER: CurrentUser = {
  id: "user-storybook",
  displayName: "Jane Doe",
  imageUrl: null,
};

/** Signs the story in as a Profile by seeding the current-user query on the story's client. */
export const withMockUser = (overrides: Partial<CurrentUser> = {}): Decorator => {
  return function WithMockUser(Story) {
    const queryClient = useQueryClient();
    queryClient.setQueryData(currentUserQueryKey, { ...DEFAULT_USER, ...overrides });
    return <Story />;
  };
};

export default definePreview({
  parameters: {
    layout: "none",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  addons: [addonDocs(), addonA11y()],
  decorators: [withQueryAndServices],
});
