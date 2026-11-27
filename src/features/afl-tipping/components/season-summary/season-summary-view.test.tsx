import { describe, it, expect } from "vite-plus/test";
import { screen } from "@testing-library/react";
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
    it("says when Opening Round starts, offers to tip it and shows no scores", async () => {
      await renderSummary({ status: "upcoming", season: 2027, activeRoundName: "Opening Round" });
      expect(
        await screen.findByText(/Opening Round starts Wednesday,? 17 March/),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Tip Opening Round" })).toBeInTheDocument();
      expect(screen.getByText("No scores yet")).toBeInTheDocument();
      expect(screen.queryByText("Wooden spoon")).not.toBeInTheDocument();
    });
  });
});
