import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { PlayerStats } from "./player-stats";
import { createTestQueryClient, renderWithClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import {
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";
import type { AflPlayerStatsEntry } from "~/features/afl-tipping/types";

vi.mock("@clerk/tanstack-react-start", () => ({
  useUser: () => ({ user: { id: "user-1" } }),
}));

const mockGetPlayerStats = vi.fn().mockResolvedValue([]);
const mockGetGames = vi.fn().mockResolvedValue([]);

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getPlayerStats: (...args: unknown[]) => mockGetPlayerStats(...args),
      getGames: (...args: unknown[]) => mockGetGames(...args),
    }),
  },
}));

function makeEntries(): AflPlayerStatsEntry[] {
  return [
    createAflPlayerStatsEntry({
      userId: "user-1",
      displayName: "Alice",
      season: { correctTips: 10, accuracy: 60, currentStreak: 4, totalMarginDiff: 20 },
      rounds: [
        createAflPlayerRoundStats({ round: 1, correctTips: 6, marginDiff: 10 }),
        createAflPlayerRoundStats({
          round: 2,
          correctTips: 3,
          marginDiff: 30,
          underdogCount: 1,
          meetsMinimum: false,
        }),
      ],
    }),
    createAflPlayerStatsEntry({
      userId: "user-2",
      displayName: "Bob",
      season: { correctTips: 8, accuracy: 50, currentStreak: 0, totalMarginDiff: 40 },
      rounds: [
        createAflPlayerRoundStats({ round: 1, correctTips: 4, marginDiff: 25 }),
        createAflPlayerRoundStats({ round: 2, correctTips: 7, marginDiff: 5 }),
      ],
    }),
  ];
}

function renderWithStats(entries: AflPlayerStatsEntry[]) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(aflQueries.allPlayerStatsKey(), entries);
  queryClient.setQueryData(aflQueries.allGamesKey(), []);
  renderWithClient(<PlayerStats />, queryClient);
  return queryClient;
}

describe("PlayerStats", () => {
  it("shows loading skeleton when there is no cached data", () => {
    renderWithClient(<PlayerStats />);
    expect(screen.getByText("Player Stats")).toBeInTheDocument();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state when the query fails", async () => {
    mockGetPlayerStats.mockRejectedValueOnce(new Error("Network error"));
    renderWithClient(<PlayerStats />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load player stats/)).toBeInTheDocument();
    });
  });

  it("shows the empty state when there are no rounds yet", () => {
    renderWithStats([]);
    expect(screen.getByText(/No stats to show yet/)).toBeInTheDocument();
  });

  it("defaults to the last available round and shows per-round stats", () => {
    renderWithStats(makeEntries());

    expect(screen.getByText("Round 2")).toBeInTheDocument();
    // Bob's round 2: 7 correct of 9, margin diff 5
    expect(screen.getByText("7/9")).toBeInTheDocument();
    expect(screen.getByText("3/9")).toBeInTheDocument();
  });

  it("sorts the round view by that round's correct tips", () => {
    renderWithStats(makeEntries());

    const names = screen.getAllByText(/^(Alice|Bob)$/).map((el) => el.textContent);
    expect(names).toEqual(["Bob", "Alice"]);
  });

  it("navigates to the previous round", () => {
    renderWithStats(makeEntries());

    fireEvent.click(screen.getByRole("button", { name: "Previous round" }));

    expect(screen.getByText("Round 1")).toBeInTheDocument();
    expect(screen.getByText("6/9")).toBeInTheDocument();
    const names = screen.getAllByText(/^(Alice|Bob)$/).map((el) => el.textContent);
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("shows season totals, accuracy and streaks in the season view", () => {
    renderWithStats(makeEntries());

    fireEvent.click(screen.getByRole("button", { name: "Season" }));

    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("10/18")).toBeInTheDocument();
    expect(screen.getByText(/Whole-season totals/)).toBeInTheDocument();
    // Season view keeps server order (Alice has more season correct tips)
    const names = screen.getAllByText(/^(Alice|Bob)$/).map((el) => el.textContent);
    expect(names).toEqual(["Alice", "Bob"]);
  });

  it("expands a player's row into a round-by-round breakdown", () => {
    renderWithStats(makeEntries());

    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));

    expect(screen.getByText("R1")).toBeInTheDocument();
    expect(screen.getByText("R2")).toBeInTheDocument();
    expect(screen.getByText(/best 5/)).toBeInTheDocument();

    // Clicking again collapses it
    fireEvent.click(screen.getByRole("button", { name: /Alice/ }));
    expect(screen.queryByText("R1")).not.toBeInTheDocument();
  });

  it("shows a You badge on the current user's row", () => {
    renderWithStats(makeEntries());
    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("explains the underdog rule for regular rounds and N/A for finals", () => {
    const entries = [
      createAflPlayerStatsEntry({
        rounds: [createAflPlayerRoundStats({ round: 25, isFinals: true, meetsMinimum: true })],
      }),
    ];
    renderWithStats(entries);

    expect(screen.getByText(/Finals round - underdog rule does not apply/)).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });
});
