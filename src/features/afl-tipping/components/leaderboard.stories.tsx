import preview, {
  centeredYDecorator,
  containerDecorator,
} from "#.storybook/preview";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";
import { createAflLeaderboardEntry } from "~/features/afl-tipping/mocks/factories";

const LEADERBOARD = [
  createAflLeaderboardEntry({
    userId: "user-1",
    displayName: "Alice Johnson",
    correctTips: 18,
    totalTips: 20,
    accuracy: 90.0,
  }),
  createAflLeaderboardEntry({
    userId: "user-2",
    displayName: "Bob Williams",
    correctTips: 15,
    totalTips: 20,
    accuracy: 75.0,
  }),
  createAflLeaderboardEntry({
    userId: "user-storybook",
    displayName: "You (Current User)",
    avatarUrl: null,
    correctTips: 14,
    totalTips: 20,
    accuracy: 70.0,
  }),
  createAflLeaderboardEntry({
    userId: "user-4",
    displayName: "Charlie Brown",
    correctTips: 12,
    totalTips: 20,
    accuracy: 60.0,
  }),
  createAflLeaderboardEntry({
    userId: "user-5",
    displayName: "Diana Prince",
    correctTips: 10,
    totalTips: 20,
    accuracy: 50.0,
  }),
];

const leaderboardService = (data: ReturnType<typeof createAflLeaderboardEntry>[]) => ({
  aflService: {
    getLeaderboard: async () => data,
  },
});

const meta = preview.meta({
  component: Leaderboard,
  parameters: {
    layout: "padded",
    services: leaderboardService(LEADERBOARD),
  },
  decorators: [containerDecorator("max-w-xl"), centeredYDecorator],
});

export const Default = meta.story({
  tags: ["demo"],
});

export const Empty = meta.story({
  parameters: {
    services: leaderboardService([]),
  },
});

export const SingleUser = meta.story({
  parameters: {
    services: leaderboardService([
      createAflLeaderboardEntry({
        userId: "user-storybook",
        displayName: "Solo Tipper",
        correctTips: 5,
        totalTips: 9,
        accuracy: 55.6,
      }),
    ]),
  },
});
