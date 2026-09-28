import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { HubPage } from "~/features/hub/pages/hub";
import { APPS } from "~/features/hub/apps";

const mockSetLaunchApp = vi.fn().mockResolvedValue(undefined);

vi.mock("~/features/hub/api/launch-app", () => ({
  setLaunchApp: (...args: unknown[]) => mockSetLaunchApp(...args),
}));

function renderHub(launchAppId: string | null = null) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    loader: () => ({ launchAppId }),
    component: HubPage,
  });
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: rootRoute.addChildren([
      indexRoute,
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

  it("saves the launch preference when the toggle is switched on", async () => {
    const user = userEvent.setup();
    renderHub();
    const toggle = await screen.findByRole("switch", {
      name: /open this app when i launch hot shots/i,
    });
    await user.click(toggle);
    expect(mockSetLaunchApp).toHaveBeenCalledWith({ data: APPS[0].id });
  });

  it("shows the current launch preference as checked", async () => {
    renderHub(APPS[0].id);
    const toggle = await screen.findByRole("switch", {
      name: /open this app when i launch hot shots/i,
    });
    expect(toggle).toBeChecked();
  });
});
