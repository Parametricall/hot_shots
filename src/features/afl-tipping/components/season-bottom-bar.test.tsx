import { describe, expect, it } from "vite-plus/test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeasonBottomBar } from "./season-bottom-bar";
import { renderInSeasonRouter } from "~/test/render";

describe("SeasonBottomBar", () => {
  it("is a navigation landmark with the four sections in order, then More", async () => {
    await renderInSeasonRouter(<SeasonBottomBar season={2026} activeTab="tips" />);
    const nav = await screen.findByRole("navigation", { name: "AFL Tipping" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Tips",
      "Round",
      "Leaderboard",
      "Stats",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/afl-tipping/2026/tips",
      "/afl-tipping/2026/group-tips",
      "/afl-tipping/2026/leaderboard",
      "/afl-tipping/2026/stats",
    ]);
    expect(within(nav).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("marks only the section open as the current page", async () => {
    await renderInSeasonRouter(<SeasonBottomBar season={2026} activeTab="leaderboard" />);
    expect(await screen.findByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tips" })).not.toHaveAttribute("aria-current");
  });

  it("marks none on the Season summary", async () => {
    await renderInSeasonRouter(<SeasonBottomBar season={2026} activeTab="summary" />);
    await screen.findByRole("navigation");
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("keeps the Round in the URL when switching section", async () => {
    const { router } = await renderInSeasonRouter(
      <SeasonBottomBar season={2026} activeTab="tips" />,
      { path: "/afl-tipping/2026/tips?round=7" },
    );
    await userEvent.setup().click(await screen.findByRole("link", { name: "Round" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/afl-tipping/2026/group-tips"),
    );
    expect(router.state.location.search).toMatchObject({ round: 7 });
  });
});
