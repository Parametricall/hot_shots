import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vite-plus/test";
import { routeTree } from "~/routeTree.gen";

// Installed PWAs and shared links keep the URLs from before Seasons, so those must still match
// their own redirecting routes and never fall into `$season`.
function matchedIds(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return router.matchRoutes(path, {}).map((match) => match.routeId);
}

describe("AFL Tipping routes", () => {
  it.each(["tips", "group-tips", "standings", "stats"])(
    "matches the legacy /afl-tipping/%s to its redirect, not to a Season",
    (tab) => {
      const ids = matchedIds(`/afl-tipping/${tab}`);
      expect(ids).toContain(`/_authenticated/afl-tipping/${tab}`);
      expect(ids).not.toContain("/_authenticated/afl-tipping/$season");
    },
  );

  it.each(["tips", "group-tips", "leaderboard", "standings", "stats"])(
    "matches /afl-tipping/2026/%s to the Season's tab",
    (tab) => {
      const ids = matchedIds(`/afl-tipping/2026/${tab}`);
      expect(ids).toContain("/_authenticated/afl-tipping/$season");
      expect(ids).toContain(`/_authenticated/afl-tipping/$season/${tab}`);
    },
  );

  it("matches /afl-tipping/2026 to the Season summary", () => {
    expect(matchedIds("/afl-tipping/2026")).toContain("/_authenticated/afl-tipping/$season/");
  });

  it("matches /afl-tipping to the redirect to the Current Season", () => {
    const ids = matchedIds("/afl-tipping");
    expect(ids).toContain("/_authenticated/afl-tipping/");
    expect(ids).not.toContain("/_authenticated/afl-tipping/$season");
  });
});

describe("the old Ladder tab", () => {
  it("redirects to the AFL Ladder view of Stats, keeping the Round", async () => {
    const { Route } = await import("./$season/standings");
    const beforeLoad = Route.options.beforeLoad as (args: unknown) => void;
    let thrown: unknown;
    try {
      beforeLoad({ params: { season: 2026 }, search: { round: 4 } });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      options: {
        to: "/afl-tipping/$season/stats",
        params: { season: 2026 },
        search: { round: 4, view: "ladder" },
      },
    });
  });
});
