import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@testing-library/react";
import { GroupTipsList } from "./group-tips-list";
import { createTestQueryClient } from "~/test/render";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import {
  createAflGame,
  createAflGroupTipEntry,
  createAflTeam,
  fakeTeams,
} from "~/features/afl-tipping/mocks/factories";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";

vi.mock("/dummy-footy-logo.png?url", () => ({ default: "test-logo.png" }));

vi.mock("~/features/auth/use-current-user", () => ({
  useCurrentUser: () => ({ id: "test-user", displayName: "Test User", imageUrl: null }),
}));

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
  queryClient.setQueryData(aflQueries.allGames().queryKey, opts.games ?? games);
  queryClient.setQueryData(aflQueries.teams().queryKey, teams);
  queryClient.setQueryData(aflQueries.groupTips(1).queryKey, opts.groupTips ?? []);
}

function renderGroupTips(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div>Loading...</div>}>
        <CurrentRoundProvider state={1}>
          <GroupTipsList />
        </CurrentRoundProvider>
      </Suspense>
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

  it("marks only the auto-tipped Tipster once the game has started", () => {
    const pastTime = Date.now() - 1000 * 60 * 60;
    const startedGames = [
      createAflGame({
        id: 100,
        round: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        unixTime: pastTime,
        date: new Date(pastTime),
      }),
    ];
    const queryClient = createTestQueryClient();
    populateData(queryClient, {
      games: startedGames,
      groupTips: [
        createAflGroupTipEntry({
          userId: "user-1",
          displayName: "Alice",
          gameId: 100,
          tipTeamId: 1,
          isAutoTip: true,
        }),
        createAflGroupTipEntry({
          userId: "user-2",
          displayName: "Bob",
          gameId: 100,
          tipTeamId: 1,
        }),
      ],
    });
    renderGroupTips(queryClient);

    expect(screen.getAllByText("auto")).toHaveLength(1);
    expect(screen.getByText("Alice").closest("[data-slot=badge]")).toHaveTextContent("auto");
    expect(screen.getByText("Bob").closest("[data-slot=badge]")).not.toHaveTextContent("auto");
  });
});
