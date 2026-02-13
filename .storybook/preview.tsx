import addonA11y from "@storybook/addon-a11y";
import addonDocs from "@storybook/addon-docs";
import type { Decorator } from "@storybook/react-vite";
import { definePreview } from "@storybook/react-vite";
import { HTMLProps } from "react";
import { cn } from "~/lib/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ServiceRegistry, { ServiceTypes } from "~/service-registry";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";

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

export function withServices(queryClient: QueryClient): Decorator {
  return function withServicesDecorator(Story, context) {
    queryClient.clear();
    ServiceRegistry.clearServices();

    const services = (context.parameters.services || {}) as Record<
      keyof ServiceTypes,
      Partial<ServiceTypes[keyof ServiceTypes]>
    >;

    Object.entries(services).forEach(([key, service]) => {
      ServiceRegistry.registerService(
        key as keyof typeof services,
        service as ServiceTypes[keyof ServiceTypes],
      );
    });

    return <Story />;
  };
}

export const withRouter: Decorator = (Story) => {
  const rootRoute = createRootRoute({
    component: () => <Outlet />,
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <Story />,
  });

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([indexRoute]),
  });

  return <RouterProvider router={router} />;
};

type MockUser = {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

declare global {
  var __STORYBOOK_CLERK_USER__: MockUser | undefined;
}

export const withMockUser = (overrides: MockUser): Decorator => {
  return function WithMockUser(Story) {
    globalThis.__STORYBOOK_CLERK_USER__ = {
      id: "user-storybook",
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      imageUrl: null,
      primaryEmailAddress: { emailAddress: "jane.doe@example.com" },
      ...overrides,
    };
    return <Story />;
  };
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60 * 1000, retry: false } }, // 1 minute
});

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
  decorators: [
    withServices(queryClient),
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
});
