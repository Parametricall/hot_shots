import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { GroupTipsList } from "./group-tips-list";
import { createTestQueryClient, renderWithClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import {
  createAflGame,
  createAflTeam,
  createAflGroupTipEntry,
  fakeTeams,
} from "~/features/afl-tipping/mocks/factories";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";

vi.mock("/dummy-footy-logo.png?url", () => ({ default: "test-logo.png" }));

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getGames: vi.fn().mockResolvedValue([]),
      getAllCurrentTeams: vi.fn().mockResolvedValue([]),
      getGroupTips: vi.fn().mockResolvedValue([]),
    }),
  },
}));

const futureTime = Date.now() + 1000 * 60 * 60 * 24;

const teams = [
  createAflTeam({ id: 1, ...fakeTeams.lions }),
  createAflTeam({ id: 2, ...fakeTeams.suns }),
];

const games = [
  createAflGame({
    id: 100,
    round: 1,
    homeTeamId: 1,
    awayTeamId: 2,
    unixTime: futureTime,
    date: new Date(futureTime),
  }),
];

function populateData(
  queryClient: QueryClient,
  opts: {
    games?: typeof games;
    groupTips?: ReturnType<typeof createAflGroupTipEntry>[];
  } = {},
) {
  queryClient.setQueryData(aflQueries.games(1).queryKey, opts.games ?? games);
  queryClient.setQueryData(aflQueries.teams().queryKey, teams);
  queryClient.setQueryData(
    aflQueries.groupTips(1).queryKey,
    opts.groupTips ?? [],
  );
}

function renderGroupTips(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CurrentRoundProvider state={1}>
        <GroupTipsList />
      </CurrentRoundProvider>
    </QueryClientProvider>,
  );
}

describe("GroupTipsList", () => {
  it("shows empty state when there are no games", () => {
    const queryClient = createTestQueryClient();
    populateData(queryClient, { games: [] });
    renderGroupTips(queryClient);

    expect(screen.getByText(/No games scheduled/)).toBeInTheDocument();
  });

  it("shows tipped and not-yet-tipped sections for pre-game state", () => {
    const queryClient = createTestQueryClient();
    populateData(queryClient, {
      groupTips: [
        createAflGroupTipEntry({
          userId: "user-1",
          displayName: "Alice",
          gameId: 100,
          hasTipped: true,
        }),
        createAflGroupTipEntry({
          userId: "user-2",
          displayName: "Bob",
          gameId: 100,
          hasTipped: false,
        }),
      ],
    });
    renderGroupTips(queryClient);

    expect(screen.getByText("Tipped")).toBeInTheDocument();
    expect(screen.getByText("Not yet tipped")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders team abbreviations in matchup header", () => {
    const queryClient = createTestQueryClient();
    populateData(queryClient);
    renderGroupTips(queryClient);

    expect(screen.getByText("LIO")).toBeInTheDocument();
    expect(screen.getByText("SUN")).toBeInTheDocument();
  });
});
