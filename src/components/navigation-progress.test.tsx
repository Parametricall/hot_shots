import { act, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { NavigationProgress, NavigationProgressBar } from "~/components/navigation-progress";

describe("NavigationProgressBar", () => {
  it("shows a progress bar while active", () => {
    render(<NavigationProgressBar active />);
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeInTheDocument();
  });

  it("shows nothing while idle", () => {
    render(<NavigationProgressBar active={false} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("NavigationProgress", () => {
  it("shows the bar while a navigation waits, and hides it once the page is ready", async () => {
    let finish = () => {};
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <NavigationProgress />
          <Outlet />
        </>
      ),
    });
    const routeTree = rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => <p>Home</p> }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/slow",
        beforeLoad: () => new Promise<void>((resolve) => (finish = resolve)),
        component: () => <p>Slow page</p>,
      }),
    ]);
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });

    render(<RouterProvider router={router} />);
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    // Through the history, not `router.navigate`: the app's registered routes type its paths.
    act(() => router.history.push("/slow"));
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();

    act(() => finish());
    expect(await screen.findByText("Slow page")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
