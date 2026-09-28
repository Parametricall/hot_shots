import { useState } from "react";
import type { Decorator } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import preview from "#.storybook/preview";
import { HubPage } from "~/features/hub/pages/hub";
import { APPS } from "~/features/hub/apps";

function withHubRouter(launchAppId: (typeof APPS)[number]["id"] | null): Decorator {
  return function WithHubRouter() {
    const [router] = useState(() => {
      const rootRoute = createRootRoute();
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        loader: () => ({ launchAppId }),
        component: HubPage,
      });
      return createRouter({
        history: createMemoryHistory({ initialEntries: ["/"] }),
        routeTree: rootRoute.addChildren([
          indexRoute,
          createRoute({ getParentRoute: () => rootRoute, path: "/afl-tipping/tips" }),
        ]),
      });
    });
    return <RouterProvider router={router} />;
  };
}

const meta = preview.meta({
  parameters: {
    layout: "fullscreen",
  },
});

export const Default = meta.story({
  decorators: [withHubRouter(null)],
});

export const WithLaunchPreferenceSet = meta.story({
  decorators: [withHubRouter(APPS[0].id)],
});
