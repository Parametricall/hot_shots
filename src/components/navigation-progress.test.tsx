import { act, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterContextProvider,
  RouterProvider,
} from "@tanstack/react-router";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
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

  it("hydrates without a mismatch while the page's routes are still loading", async () => {
    // The Demo's AFL routes render in the browser only: the server renders the shell with the
    // router idle, and the browser hydrates it while those routes are still loading.
    const routerOnPage = async (initialLoad: "finished" | "pending") => {
      const rootRoute = createRootRoute();
      const routeTree = rootRoute.addChildren([
        createRoute({
          getParentRoute: () => rootRoute,
          path: "/",
          loader: () => (initialLoad === "pending" ? new Promise<void>(() => {}) : undefined),
        }),
      ]);
      const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
      const load = router.load();
      if (initialLoad === "finished") await load;
      else await new Promise((resolve) => setTimeout(resolve));
      return router;
    };
    const serverRouter = await routerOnPage("finished");
    const browserRouter = await routerOnPage("pending");
    expect(browserRouter.state.status).toBe("pending");

    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <RouterContextProvider router={serverRouter}>
        <NavigationProgress />
      </RouterContextProvider>,
    );
    document.body.append(container);
    const mismatches: unknown[] = [];
    await act(async () => {
      hydrateRoot(
        container,
        <RouterContextProvider router={browserRouter}>
          <NavigationProgress />
        </RouterContextProvider>,
        { onRecoverableError: (error) => mismatches.push(error) },
      );
    });

    expect(mismatches).toEqual([]);
    // Once hydrated, the bar shows for the navigation still waiting.
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    container.remove();
  });
});
