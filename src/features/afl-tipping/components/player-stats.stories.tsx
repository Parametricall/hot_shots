import preview, { withMockUser } from "#.storybook/preview";
import { PlayerStats } from "~/features/afl-tipping/components/player-stats";
import {
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";
import { expect, within, waitFor, userEvent } from "storybook/test";

const PLAYER_STATS = [
  createAflPlayerStatsEntry({
    userId: "user-1",
    displayName: "Alice Johnson",
    season: {
      correctTips: 18,
      gamesTipped: 26,
      gamesCompleted: 27,
      accuracy: (18 / 26) * 100,
      totalMarginDiff: 12,
      currentStreak: 5,
      longestStreak: 8,
      totalUnderdogs: 7,
    },
    rounds: [
      createAflPlayerRoundStats({ round: 1, correctTips: 7, marginDiff: 4 }),
      createAflPlayerRoundStats({ round: 2, correctTips: 6, marginDiff: 3 }),
      createAflPlayerRoundStats({ round: 3, correctTips: 9, marginDiff: 5 }),
    ],
  }),
  createAflPlayerStatsEntry({
    userId: "user-storybook",
    displayName: "You (Current User)",
    season: {
      correctTips: 15,
      gamesTipped: 27,
      gamesCompleted: 27,
      accuracy: (15 / 27) * 100,
      totalMarginDiff: 35,
      currentStreak: 0,
      longestStreak: 4,
      totalUnderdogs: 5,
    },
    rounds: [
      createAflPlayerRoundStats({ round: 1, correctTips: 5, marginDiff: 20 }),
      createAflPlayerRoundStats({ round: 2, correctTips: 6, marginDiff: 8 }),
      createAflPlayerRoundStats({
        round: 3,
        correctTips: 4,
        marginDiff: 7,
        underdogCount: 1,
        meetsMinimum: false,
      }),
    ],
  }),
  createAflPlayerStatsEntry({
    userId: "user-3",
    displayName: "Charlie Brown",
    season: {
      correctTips: 12,
      gamesTipped: 18,
      gamesCompleted: 27,
      accuracy: (12 / 18) * 100,
      totalMarginDiff: 42,
      currentStreak: 2,
      longestStreak: 6,
      totalUnderdogs: 9,
    },
    rounds: [
      createAflPlayerRoundStats({ round: 1, correctTips: 6, marginDiff: 15 }),
      createAflPlayerRoundStats({
        round: 2,
        correctTips: 4,
        marginDiff: null,
        underdogCount: 0,
        meetsMinimum: false,
      }),
      createAflPlayerRoundStats({ round: 3, correctTips: 2, marginDiff: 20 }),
    ],
  }),
];

const playerStatsService = (data: ReturnType<typeof createAflPlayerStatsEntry>[]) => ({
  aflService: {
    getPlayerStats: async () => data,
  },
  squiggleService: {
    getGames: async () => [],
  },
});

const meta = preview.meta({
  component: PlayerStats,
  parameters: {
    layout: "centered",
    services: playerStatsService(PLAYER_STATS),
  },
  decorators: [withMockUser()],
});

export const Default = meta.story({
  tags: ["demo"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() => {
      expect(canvas.getByText("Alice Johnson")).toBeInTheDocument();
    });
    expect(canvas.getByText("Player Stats")).toBeInTheDocument();
    // Defaults to the last round
    expect(canvas.getByText("Round 3")).toBeInTheDocument();
    // Current user gets the You badge
    expect(canvas.getByText("You")).toBeInTheDocument();
  },
});

export const SeasonView = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("Alice Johnson")).toBeInTheDocument();
    });

    await userEvent.click(canvas.getByRole("button", { name: "Season" }));

    expect(canvas.getByText(/Whole-season totals/)).toBeInTheDocument();
    expect(canvas.getByText("69%")).toBeInTheDocument(); // Alice: 18 of 26
    expect(canvas.getByText("18/27")).toBeInTheDocument();
  },
});

export const ExpandedRow = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("Alice Johnson")).toBeInTheDocument();
    });

    await userEvent.click(canvas.getByRole("button", { name: /Alice Johnson/ }));

    expect(canvas.getByText("R1")).toBeInTheDocument();
    expect(canvas.getByText(/best 8/)).toBeInTheDocument();
  },
});

export const RoundNavigation = meta.story({
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText("Round 3")).toBeInTheDocument();
    });

    await userEvent.click(canvas.getByRole("button", { name: "Previous round" }));

    expect(canvas.getByText("Round 2")).toBeInTheDocument();
  },
});

export const FinalsRound = meta.story({
  parameters: {
    services: playerStatsService([
      createAflPlayerStatsEntry({
        userId: "user-1",
        displayName: "Alice Johnson",
        rounds: [
          createAflPlayerRoundStats({ round: 24, correctTips: 6 }),
          createAflPlayerRoundStats({
            round: 25,
            isFinals: true,
            correctTips: 3,
            gamesCompleted: 4,
            underdogCount: 0,
            meetsMinimum: true,
          }),
        ],
      }),
    ]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/Finals round/)).toBeInTheDocument();
    });
    expect(canvas.getByText("N/A")).toBeInTheDocument();
  },
});

export const Empty = meta.story({
  parameters: {
    services: playerStatsService([]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/No stats to show yet/)).toBeInTheDocument();
    });
  },
});

export const Loading = meta.story({
  parameters: {
    services: {
      aflService: {
        getPlayerStats: () => new Promise(() => {}),
      },
      squiggleService: {
        getGames: async () => [],
      },
    },
  },
});

export const Error = meta.story({
  parameters: {
    services: {
      aflService: {
        getPlayerStats: () => Promise.reject(new globalThis.Error("Network error")),
      },
      squiggleService: {
        getGames: async () => [],
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/Failed to load player stats/)).toBeInTheDocument();
    });
    expect(canvas.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  },
});
