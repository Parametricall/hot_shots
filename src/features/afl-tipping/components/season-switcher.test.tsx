import { describe, it, expect, vi } from "vite-plus/test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasonSwitcher } from "./season-switcher";
import { PastSeasonBanner } from "./past-season-banner";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createTestQueryClient, renderInSeasonRouter } from "~/test/render";
import type { Seasons } from "~/features/afl-tipping/utils/afl-season";

const mockSeason = vi.hoisted(() => ({ value: 2026 }));
vi.mock("~/features/afl-tipping/hooks/use-season", () => ({ useSeason: () => mockSeason.value }));

vi.mock("~/app/service-registry", () => ({
  default: { getService: vi.fn().mockReturnValue({}) },
}));

function clientWith(seasons: Seasons) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(aflQueries.seasonsKey(), seasons);
  return queryClient;
}

const TWO: Seasons = {
  seasons: [2027, 2026],
  current: { season: 2027, status: "in-progress", firstGameAt: 0 },
};

describe("SeasonSwitcher", () => {
  it("is hidden while there is a single Season", async () => {
    mockSeason.value = 2026;
    const queryClient = clientWith({
      seasons: [2026],
      current: { season: 2026, status: "in-progress", firstGameAt: 0 },
    });
    await renderInSeasonRouter(<SeasonSwitcher tab="stats" />, { queryClient });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lists Seasons newest first, marks the current one and keeps the tab on a pick", async () => {
    mockSeason.value = 2027;
    const user = userEvent.setup();
    const { router } = await renderInSeasonRouter(<SeasonSwitcher tab="stats" />, {
      queryClient: clientWith(TWO),
      path: "/afl-tipping/2027/stats?round=4",
    });

    await user.click(await screen.findByRole("button", { name: /Season, 2027/ }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["2027Current", "2026"]);

    await user.click(items[1]!);
    await waitFor(() => expect(router.state.location.pathname).toBe("/afl-tipping/2026/stats"));
    expect(router.state.location.search).not.toHaveProperty("round");
  });
});

describe("PastSeasonBanner", () => {
  it("is hidden on the Current Season", async () => {
    mockSeason.value = 2027;
    await renderInSeasonRouter(<PastSeasonBanner />, { queryClient: clientWith(TWO) });
    expect(screen.queryByText(/You're viewing/)).not.toBeInTheDocument();
  });

  it("links a past Season back to the Current Season's My Tips", async () => {
    mockSeason.value = 2026;
    await renderInSeasonRouter(<PastSeasonBanner />, { queryClient: clientWith(TWO) });
    expect(await screen.findByText(/You're viewing 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to 2027" })).toHaveAttribute(
      "href",
      "/afl-tipping/2027/tips",
    );
  });

  it("links to the Current Season's summary once it is over", async () => {
    mockSeason.value = 2025;
    await renderInSeasonRouter(<PastSeasonBanner />, {
      queryClient: clientWith({
        seasons: [2026, 2025],
        current: { season: 2026, status: "over", firstGameAt: 0 },
      }),
    });
    expect(await screen.findByRole("link", { name: "Back to 2026" })).toHaveAttribute(
      "href",
      "/afl-tipping/2026",
    );
  });
});
