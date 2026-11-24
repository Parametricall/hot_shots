import { describe, it, expect } from "vite-plus/test";
import { screen } from "@testing-library/react";
import { SeasonSummaryView, type SeasonSummaryViewProps } from "./season-summary-view";
import { createAflLeaderboardEntry } from "~/features/afl-tipping/mocks/factories";
import { renderInSeasonRouter } from "~/test/render";

function entry(userId: string, score: number, totalMarginDiff = 0) {
  return createAflLeaderboardEntry({
    userId,
    displayName: `Tipster ${userId}`,
    score,
    totalMarginDiff,
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
      await screen.findByText("Podium");
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
