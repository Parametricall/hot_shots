import { describe, it, expect, vi } from "vite-plus/test";
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach } from "vite-plus/test";
import { Leaderboard } from "./leaderboard";
import { createTestQueryClient, renderWithClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import {
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";

vi.mock("~/features/afl-tipping/hooks/use-season", () => ({ useSeason: () => 2026 }));

vi.mock("~/features/auth/use-current-user", () => ({
  useCurrentUser: () => ({ id: "user-1", displayName: "Test User", imageUrl: null }),
}));

const mockGetLeaderboard = vi.fn().mockResolvedValue([]);

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
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
  it("shows loading skeleton when there is no cached data", () => {
    renderWithClient(<Leaderboard />);
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows error state when the query fails", async () => {
    mockGetLeaderboard.mockRejectedValueOnce(new Error("Network error"));
    renderWithClient(<Leaderboard />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load the leaderboard/)).toBeInTheDocument();
    });
  });

  it("shows the empty state when the leaderboard has no entries", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), []);
    renderWithClient(<Leaderboard />, queryClient);
    expect(screen.getByText(/No tips have been submitted yet/)).toBeInTheDocument();
  });

  it("renders each entry's display name, score and margin diff", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "user-1", displayName: "Alice", score: 7, totalMarginDiff: 5 }),
      makeEntry({ userId: "user-2", displayName: "Bob", score: 4, totalMarginDiff: 20 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("shows a number label for rank 4 when it is not last place", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "u1", displayName: "A", score: 10, totalMarginDiff: 0 }),
      makeEntry({ userId: "u2", displayName: "B", score: 8, totalMarginDiff: 0 }),
      makeEntry({ userId: "u3", displayName: "C", score: 6, totalMarginDiff: 0 }),
      makeEntry({ userId: "u4", displayName: "D", score: 3, totalMarginDiff: 0 }),
      makeEntry({ userId: "u5", displayName: "E", score: 1, totalMarginDiff: 0 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    // Rank 4 is rendered as a text span (not a Trophy/Medal/Award icon)
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows a wooden spoon icon for the last place entry", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "u1", displayName: "A", score: 10, totalMarginDiff: 0 }),
      makeEntry({ userId: "u2", displayName: "B", score: 8, totalMarginDiff: 0 }),
      makeEntry({ userId: "u3", displayName: "C", score: 6, totalMarginDiff: 0 }),
      makeEntry({ userId: "u4", displayName: "D", score: 3, totalMarginDiff: 0 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    // Last place gets the wooden spoon SVG instead of a number
    expect(screen.queryByText("4")).not.toBeInTheDocument();
    const svg = screen.getByTestId("wooden-spoon");
    expect(svg).toBeInTheDocument();
  });

  it("assigns the same rank to tied entries and skips ahead for the next distinct entry", () => {
    const queryClient = createTestQueryClient();
    const tied = { score: 5, totalMarginDiff: 10 };
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "u1", displayName: "A", ...tied }),
      makeEntry({ userId: "u2", displayName: "B", ...tied }),
      makeEntry({ userId: "u3", displayName: "C", ...tied }),
      makeEntry({ userId: "u4", displayName: "D", score: 3, totalMarginDiff: 5 }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    // A, B, C are all rank 1 (Trophy icon). D should be in last place and show the wooden-spoon.
    expect(screen.getByTestId("wooden-spoon")).toBeInTheDocument();
  });

  it("shows a You badge on the current user's row", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "user-1", displayName: "Me" }),
      makeEntry({ userId: "user-2", displayName: "Other" }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("does not show a You badge when no entry matches the current user", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "user-99", displayName: "Stranger" }),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("labels the columns Rnd, Score and Margin diff", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [makeEntry()]);
    renderWithClient(<Leaderboard />, queryClient);

    expect(screen.getByText("Rnd")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Margin diff")).toBeInTheDocument();
    expect(screen.queryByText("Margin")).not.toBeInTheDocument();
  });

  it("shows this Round's Correct tips and the places gained or lost since the Round before", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
      makeEntry({ userId: "b", displayName: "Bea", score: 13, totalMarginDiff: 20 }),
      makeEntry({ userId: "a", displayName: "Abe", score: 9, totalMarginDiff: 20 }),
    ]);
    // Round 1: Abe 7, Bea 5. Round 2: Abe 2, Bea 8. Bea overtakes Abe.
    const stats = (userId: string, r1: number, r2: number) =>
      createAflPlayerStatsEntry({
        userId,
        rounds: [
          createAflPlayerRoundStats({ round: 1, correctTips: r1, marginDiff: 10 }),
          createAflPlayerRoundStats({ round: 2, correctTips: r2, marginDiff: 10 }),
        ],
      });
    queryClient.setQueryData(aflQueries.allPlayerStatsKey(2026), [
      stats("a", 7, 2),
      stats("b", 5, 8),
    ]);
    renderWithClient(<Leaderboard />, queryClient);

    const rows = screen.getAllByText(/^(Abe|Bea)$/).map((el) => el.closest("div.p-3")!);
    expect(within(rows[0] as HTMLElement).getByText("Up 1 place")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("8")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Down 1 place")).toBeInTheDocument();
    expect(screen.getByText(/Correct tips in Round 2/)).toBeInTheDocument();
  });

  describe("own row pinned to the bottom", () => {
    let callback: IntersectionObserverCallback | undefined;
    class FakeObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      callback = undefined;
    });

    function renderBoard() {
      vi.stubGlobal("IntersectionObserver", FakeObserver);
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(aflQueries.allLeaderboardKey(2026), [
        makeEntry({ userId: "other", displayName: "Other", score: 9 }),
        makeEntry({ userId: "user-1", displayName: "Me", score: 5 }),
      ]);
      renderWithClient(<Leaderboard />, queryClient);
    }

    it("shows a copy of the viewer's row once it scrolls out of view", async () => {
      renderBoard();
      expect(screen.queryByTestId("own-row-pinned")).not.toBeInTheDocument();

      act(() => callback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as never));
      const pinned = await screen.findByTestId("own-row-pinned");
      expect(within(pinned).getByText("Me")).toBeInTheDocument();
    });

    it("hides the copy while the viewer's own row is on screen", async () => {
      renderBoard();
      act(() => callback?.([{ isIntersecting: false } as IntersectionObserverEntry], {} as never));
      await screen.findByTestId("own-row-pinned");

      act(() => callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as never));
      await waitFor(() => expect(screen.queryByTestId("own-row-pinned")).not.toBeInTheDocument());
    });
  });
});
