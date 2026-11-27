import { describe, it, expect } from "vite-plus/test";
import { screen, within } from "@testing-library/react";
import { SeasonSummaryView, type SeasonSummaryViewProps } from "./season-summary-view";
import {
  createAflLeaderboardEntry,
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";
import { renderInSeasonRouter } from "~/test/render";

function entry(userId: string, score: number, totalMarginDiff = 0) {
  return createAflLeaderboardEntry({
    userId,
    displayName: `Tipster ${userId}`,
    score,
    totalMarginDiff,
  });
}

function stats(userId: string, longestStreak: number, accuracy: number | null = 70) {
  return createAflPlayerStatsEntry({
    userId,
    displayName: `Tipster ${userId}`,
    season: { longestStreak, accuracy, totalUnderdogs: 0, totalMarginDiff: 0 },
    rounds: [createAflPlayerRoundStats({ round: 3, correctTips: 0, marginDiff: null })],
  });
}

const FIVE = [entry("a", 9), entry("b", 8), entry("c", 7), entry("d", 6), entry("e", 2)];

async function renderSummary(overrides: Partial<SeasonSummaryViewProps> = {}) {
  const props: SeasonSummaryViewProps = {
    season: 2026,
    status: "over",
    firstGameAt: Date.UTC(2027, 2, 17, 8, 30),
    activeRoundName: "Round 5",
    leaderboard: FIVE,
    userId: undefined,
    ...overrides,
  };
  return renderInSeasonRouter(<SeasonSummaryView {...props} />);
}

describe("SeasonSummaryView", () => {
  describe("over", () => {
    it("shows the final heading, the podium and the Wooden spoon", async () => {
      await renderSummary({ userId: "c" });
      await screen.findByText("Champion");
      expect(await screen.findByText("2026 Season, final")).toBeInTheDocument();
      expect(screen.getByText("Tipster a")).toBeInTheDocument();
      expect(screen.getByText("Tipster c")).toBeInTheDocument();
      expect(screen.queryByText("Tipster d")).not.toBeInTheDocument();
      expect(screen.getByText("Wooden spoon")).toBeInTheDocument();
      expect(screen.getByText("Tipster e")).toBeInTheDocument();
      expect(screen.getByText("You finished 3rd of 5")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Full Leaderboard" })).toHaveAttribute(
        "href",
        "/afl-tipping/2026/leaderboard",
      );
      expect(screen.queryByRole("link", { name: /^Tip / })).not.toBeInTheDocument();
    });

    it("shows the Champion with their Score and Accuracy", async () => {
      await renderSummary({ playerStats: [stats("a", 4, 82.4)] });
      expect(await screen.findByRole("heading", { name: "Champion" })).toBeInTheDocument();
      expect(screen.getByText("82%")).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText("TA")).toBeInTheDocument();
    });

    it("shares the Champion when the top rank is tied", async () => {
      await renderSummary({
        leaderboard: [entry("a", 9), entry("b", 9), entry("c", 7)],
      });
      expect(await screen.findByRole("heading", { name: "Champions" })).toBeInTheDocument();
    });

    it("lists the Season awards, and calls out the ones the viewer won", async () => {
      await renderSummary({
        userId: "c",
        playerStats: [stats("a", 4), stats("b", 3), stats("c", 12)],
        roundNames: { 3: "Round 3" },
      });
      expect(await screen.findByRole("heading", { name: "Season awards" })).toBeInTheDocument();
      expect(screen.getByText("12 Correct tips in a row")).toBeInTheDocument();
      expect(screen.getByText("You won Longest streak")).toBeInTheDocument();
    });

    it("leaves out Season awards that nobody earned", async () => {
      await renderSummary({ playerStats: [stats("a", 0)] });
      await screen.findByRole("heading", { name: "Champion" });
      expect(screen.queryByRole("heading", { name: "Season awards" })).not.toBeInTheDocument();
    });

    it("shows everyone tied on a podium rank with an equals sign", async () => {
      await renderSummary({
        leaderboard: [entry("a", 9), entry("b", 8), entry("c", 8), entry("d", 8), entry("e", 1)],
      });
      expect(await screen.findByText("Tipster d")).toBeInTheDocument();
      expect(screen.getAllByText("=2nd")).toHaveLength(3);
    });

    it("names every Tipster who shares the Wooden spoon", async () => {
      await renderSummary({
        leaderboard: [
          entry("a", 9),
          entry("b", 8),
          entry("c", 7),
          entry("d", 6),
          entry("e", 2, 4),
          entry("f", 2, 4),
        ],
      });
      expect(await screen.findByText("Tipster e, Tipster f")).toBeInTheDocument();
    });

    it("has no Wooden spoon when everyone is on the podium", async () => {
      await renderSummary({ leaderboard: [entry("a", 9), entry("b", 8), entry("c", 7)] });
      await screen.findByRole("heading", { name: "Champion" });
      expect(screen.queryByText("Wooden spoon")).not.toBeInTheDocument();
    });
  });

  describe("in progress", () => {
    it("offers to tip the active Round, shows the podium so far and no Wooden spoon", async () => {
      await renderSummary({ status: "in-progress", userId: "d" });
      expect(await screen.findByRole("link", { name: "Tip Round 5" })).toHaveAttribute(
        "href",
        "/afl-tipping/2026/tips",
      );
      expect(screen.getByText("2026 Season")).toBeInTheDocument();
      expect(screen.getByText("Top three so far")).toBeInTheDocument();
      expect(screen.getByText("You're 4th of 5")).toBeInTheDocument();
      expect(screen.queryByText("Wooden spoon")).not.toBeInTheDocument();
    });

    it("says no scores yet before any Game is complete", async () => {
      await renderSummary({ status: "in-progress", leaderboard: [entry("a", 0), entry("b", 0)] });
      expect(await screen.findByText("No scores yet")).toBeInTheDocument();
    });
  });

  describe("upcoming", () => {
    // 7:30pm Wednesday 17 March 2027, Melbourne.
    const OPENING = Date.UTC(2027, 2, 17, 8, 30);
    const DAY = 86_400_000;
    const LAST_SEASON = [entry("a", 9), entry("b", 8), entry("c", 7), entry("d", 6), entry("e", 2)];
    const tipping = (...ids: string[]) => ids.map((id) => entry(id, 0));

    function renderUpcoming(overrides: Partial<SeasonSummaryViewProps> = {}) {
      return renderSummary({
        status: "upcoming",
        season: 2027,
        firstGameAt: OPENING,
        now: OPENING - 98 * DAY,
        leaderboard: tipping("a", "b", "c", "d", "e"),
        previousLeaderboard: LAST_SEASON,
        ...overrides,
      });
    }

    it("counts down to Opening Round with an outline button in the Pre-season", async () => {
      await renderUpcoming();
      expect(await screen.findByRole("heading", { name: "2027 Season" })).toBeInTheDocument();
      expect(
        screen.getByText(/Opening Round starts Wednesday,? 17 March · in 98 days/),
      ).toBeVisible();
      const tip = screen.getByRole("link", { name: "Tip Opening Round" });
      expect(tip).toHaveAttribute("href", "/afl-tipping/2027/tips");
      expect(tip).not.toHaveClass("bg-primary");
    });

    it("makes the button primary within 14 days of the first Game", async () => {
      await renderUpcoming({ now: OPENING - 14 * DAY });
      expect(await screen.findByRole("link", { name: "Tip Opening Round" })).toHaveClass(
        "bg-primary",
      );
    });

    it("says tomorrow and today for the last two days", async () => {
      await renderUpcoming({ now: OPENING - DAY });
      expect(await screen.findByText(/· tomorrow/)).toBeInTheDocument();
    });

    it("says the Fixture isn't out when there is no first Game", async () => {
      await renderUpcoming({ firstGameAt: null });
      expect(await screen.findByText("The Fixture isn't out yet")).toBeInTheDocument();
    });

    it("shows last Season's Champion back, with their Score", async () => {
      await renderUpcoming();
      expect(
        await screen.findByRole("heading", { name: "Last Season's Champion" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Score in 2026", { exact: false })).toBeInTheDocument();
      const card = screen
        .getByRole("heading", { name: "Last Season's Champion" })
        .closest("[data-slot=card]")!;
      expect(within(card as HTMLElement).getByText("Back for 2027")).toBeVisible();
    });

    it("marks the Champion and the Wooden spoon holder as not back yet", async () => {
      await renderUpcoming({ leaderboard: tipping("b", "c", "d") });
      await screen.findByRole("heading", { name: "Last Season's Champion" });
      expect(screen.getByText("Wooden spoon, 2026")).toBeInTheDocument();
      expect(screen.getAllByText("Not back yet", { selector: "[data-slot=badge]" })).toHaveLength(
        2,
      );
    });

    it("lists entrants with their finish last Season, You marked, new Tipsters last", async () => {
      await renderUpcoming({ leaderboard: tipping("d", "z", "a"), userId: "d" });
      const section = (await screen.findByRole("heading", { name: "Who's tipping in 2027" }))
        .parentElement!;
      const rows = within(section).getAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining("Tipster a1st in 2026"),
        expect.stringContaining("Tipster d"),
        expect.stringContaining("Tipster z"),
      ]);
      expect(rows[1]).toHaveTextContent("You");
      expect(rows[1]).toHaveTextContent("4th in 2026");
      expect(rows[2]).toHaveTextContent("New");
    });

    it("lists who hasn't entered, and hides the list when everyone is back", async () => {
      const { unmount } = await renderUpcoming({ leaderboard: tipping("a", "c") });
      const heading = await screen.findByRole("heading", { name: "Not back yet" });
      expect(within(heading.parentElement!).getAllByRole("listitem")).toHaveLength(3);
      unmount();
      await renderUpcoming();
      await screen.findByRole("heading", { name: "Who's tipping in 2027" });
      expect(screen.queryByRole("heading", { name: "Not back yet" })).not.toBeInTheDocument();
    });

    it("shows only the entrants in the first Season", async () => {
      await renderUpcoming({ previousLeaderboard: null });
      await screen.findByRole("heading", { name: "Who's tipping in 2027" });
      expect(screen.getAllByRole("listitem")).toHaveLength(5);
      expect(screen.queryByText(/Champion/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Wooden spoon/)).not.toBeInTheDocument();
      expect(screen.queryByText("New")).not.toBeInTheDocument();
      expect(screen.queryByText(/in 2026/)).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Not back yet" })).not.toBeInTheDocument();
    });
  });
});
