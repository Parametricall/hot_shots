import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Leaderboard } from "./leaderboard";
import { createTestQueryClient, renderWithClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";

vi.mock("@clerk/tanstack-react-start", () => ({
  useUser: () => ({ user: { id: "user-1" } }),
}));

vi.mock("~/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getLeaderboard: vi.fn().mockResolvedValue([]),
    }),
  },
}));

function makeEntry(overrides: Partial<AflLeaderboardEntry> = {}): AflLeaderboardEntry {
  return {
    userId: "user-x",
    displayName: "Test User",
    avatarUrl: null,
    correctTips: 5,
    score: 5,
    totalMarginDiff: 10,
    ...overrides,
  };
}

describe("Leaderboard", () => {
  it("shows loading when there is no cached data", () => {
    renderWithClient(<Leaderboard />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows the empty state when the leaderboard has no entries", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(), []);
    renderWithClient(<Leaderboard />, queryClient);
    expect(
      screen.getByText(/No tips have been submitted yet/),
    ).toBeInTheDocument();
  });

  it("renders each entry's display name, score and margin diff", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(), [
      makeEntry({ userId: "user-1", displayName: "Alice", score: 7, totalMarginDiff: 5 }),
      makeEntry({ userId: "user-2", displayName: "Bob", score: 4, totalMarginDiff: 20 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("shows a number label for rank 4 and above", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(), [
      makeEntry({ userId: "u1", displayName: "A", score: 10, totalMarginDiff: 0 }),
      makeEntry({ userId: "u2", displayName: "B", score: 8, totalMarginDiff: 0 }),
      makeEntry({ userId: "u3", displayName: "C", score: 6, totalMarginDiff: 0 }),
      makeEntry({ userId: "u4", displayName: "D", score: 3, totalMarginDiff: 0 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    // Rank 4 is rendered as a text span (not a Trophy/Medal/Award icon)
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("assigns the same rank to tied entries and skips ahead for the next distinct entry", () => {
    const queryClient = createTestQueryClient();
    const tied = { score: 5, totalMarginDiff: 10 };
    queryClient.setQueryData(aflQueries.allLeaderboardKey(), [
      makeEntry({ userId: "u1", displayName: "A", ...tied }),
      makeEntry({ userId: "u2", displayName: "B", ...tied }),
      makeEntry({ userId: "u3", displayName: "C", ...tied }),
      makeEntry({ userId: "u4", displayName: "D", score: 3, totalMarginDiff: 5 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    // A, B, C are all rank 1 (Trophy icon). D should be rank 4, shown as text.
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows a You badge on the current user's row", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(), [
      makeEntry({ userId: "user-1", displayName: "Me" }),
      makeEntry({ userId: "user-2", displayName: "Other" }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not show a You badge when no entry matches the current user", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(), [
      makeEntry({ userId: "user-99", displayName: "Stranger" }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });
});
