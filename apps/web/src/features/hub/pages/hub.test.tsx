import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { HubPage } from "~/features/hub/pages/hub";
import { APPS } from "~/features/hub/apps";

function renderHub() {
  const rootRoute = createRootRoute({ component: () => <HubPage /> });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/" }),
      createRoute({ getParentRoute: () => rootRoute, path: "/afl-tipping/tips" }),
    ]),
  });
  return render(<RouterProvider router={router} />);
}

describe("HubPage", () => {
  it("renders a card for every registered app", async () => {
    renderHub();
    for (const app of APPS) {
      const link = await screen.findByRole("link", { name: new RegExp(app.name) });
      expect(link).toHaveAttribute("href", app.href);
    }
  });
});
