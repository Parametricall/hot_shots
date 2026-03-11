import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GamesList } from "./games-list";
import { createTestQueryClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { createAflGame, createAflTeam, fakeTeams } from "~/features/afl-tipping/mocks/factories";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import type { AflUserTip } from "~/features/afl-tipping/types";

vi.mock("/dummy-footy-logo.png?url", () => ({ default: "test-logo.png" }));

vi.mock("@clerk/tanstack-react-start", () => ({
  useUser: () => ({ user: { id: "user-1" } }),
}));

vi.mock("~/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getGames: vi.fn().mockResolvedValue([]),
      getAllCurrentTeams: vi.fn().mockResolvedValue([]),
      getModelTips: vi.fn().mockResolvedValue([]),
      getTips: vi.fn().mockResolvedValue([]),
      submitTip: vi.fn().mockResolvedValue({ success: true }),
    }),
  },
}));

const futureTime = Date.now() + 1000 * 60 * 60 * 24;

const teams = [
  createAflTeam({ id: 1, ...fakeTeams.lions }),
  createAflTeam({ id: 2, ...fakeTeams.suns }),
  createAflTeam({ id: 3, ...fakeTeams.COL }),
  createAflTeam({ id: 4, ...fakeTeams.ESS }),
];

const round1Games = [
  createAflGame({
    id: 100,
    round: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    unixTime: futureTime,
    date: new Date(futureTime),
  }),
];

const round2Games = [
  createAflGame({
    id: 200,
    round: 2,
    homeTeamId: 3,
    awayTeamId: 4,
    unixTime: futureTime + 1000 * 60 * 60 * 24 * 7,
    date: new Date(futureTime + 1000 * 60 * 60 * 24 * 7),
  }),
];

function populateRoundData(
  queryClient: QueryClient,
  round: number,
  games: typeof round1Games,
  tips: AflUserTip[] = [],
) {
  const gameIds = games.map((g) => g.id);
  queryClient.setQueryData(aflQueries.games(round).queryKey, games);
  queryClient.setQueryData(aflQueries.teams().queryKey, teams);
  queryClient.setQueryData(aflQueries.modelTips(round).queryKey, []);
  queryClient.setQueryData(aflQueries.getTips(gameIds).queryKey, tips);
}

function renderGamesListForRound(round: number, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CurrentRoundProvider state={round}>
        <GamesList />
      </CurrentRoundProvider>
    </QueryClientProvider>,
  );
}

describe("GamesList margin reset on round navigation", () => {
  it("does not carry over margin from round 1 when navigating to an untipped round 2", () => {
    const queryClient = createTestQueryClient();

    // Round 1: user has tipped game 100 with margin 25
    populateRoundData(queryClient, 1, round1Games, [{ gameId: 100, tipTeamId: 1, margin: 25 }]);

    // Render round 1 — margin input should show 25
    const { rerender } = renderGamesListForRound(1, queryClient);
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();

    // Populate round 2 data with no tips
    populateRoundData(queryClient, 2, round2Games, []);

    // Navigate to round 2 by re-rendering with new round
    rerender(
      <QueryClientProvider client={queryClient}>
        <CurrentRoundProvider state={2}>
          <GamesList />
        </CurrentRoundProvider>
      </QueryClientProvider>,
    );

    // The old margin value (25) should not appear anywhere
    expect(screen.queryByDisplayValue("25")).not.toBeInTheDocument();
  });

  it("shows server margin when navigating to a round with an existing margin tip", () => {
    const queryClient = createTestQueryClient();

    // Round 1: margin 25
    populateRoundData(queryClient, 1, round1Games, [{ gameId: 100, tipTeamId: 1, margin: 25 }]);

    const { rerender } = renderGamesListForRound(1, queryClient);
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();

    // Round 2: user previously tipped with margin 10
    populateRoundData(queryClient, 2, round2Games, [{ gameId: 200, tipTeamId: 3, margin: 10 }]);

    rerender(
      <QueryClientProvider client={queryClient}>
        <CurrentRoundProvider state={2}>
          <GamesList />
        </CurrentRoundProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("25")).not.toBeInTheDocument();
  });

  it("shows empty margin input when navigating to a round with a tip but no margin set", () => {
    const queryClient = createTestQueryClient();

    // Round 1: margin 25
    populateRoundData(queryClient, 1, round1Games, [{ gameId: 100, tipTeamId: 1, margin: 25 }]);

    const { rerender } = renderGamesListForRound(1, queryClient);
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();

    // Round 2: user tipped but did not set margin
    populateRoundData(queryClient, 2, round2Games, [{ gameId: 200, tipTeamId: 3 }]);

    rerender(
      <QueryClientProvider client={queryClient}>
        <CurrentRoundProvider state={2}>
          <GamesList />
        </CurrentRoundProvider>
      </QueryClientProvider>,
    );

    // Margin input should be empty (no value), not showing old margin
    expect(screen.queryByDisplayValue("25")).not.toBeInTheDocument();
    const marginInput = screen.getByRole("spinbutton");
    expect(marginInput).toHaveValue(null);
  });
});
