import preview, { withMockUser } from "#.storybook/preview";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";
import { createAflLeaderboardEntry } from "~/features/afl-tipping/mocks/factories";
import { expect, within, waitFor } from "storybook/test";

const LEADERBOARD = [
  createAflLeaderboardEntry({
    userId: "user-1",
    displayName: "Alice Johnson",
    correctTips: 18,
    totalMarginDiff: 12,
    score: 18,
  }),
  createAflLeaderboardEntry({
    userId: "user-2",
    displayName: "Ryan Suspicious",
    correctTips: 15,
    totalMarginDiff: 20,
    score: 15,
  }),
  createAflLeaderboardEntry({
    userId: "user-storybook",
    displayName: "You (Current User)",
    avatarUrl: null,
    correctTips: 14,
    totalMarginDiff: 35,
    score: 14,
  }),
  createAflLeaderboardEntry({
    userId: "user-4",
    displayName: "Charlie Brown",
    correctTips: 12,
    totalMarginDiff: 42,
    score: 12,
  }),
  createAflLeaderboardEntry({
    userId: "user-5",
    displayName: "Diana Prince",
    correctTips: 10,
    totalMarginDiff: 50,
    score: 10,
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
    layout: "centered",
    services: {
      ...leaderboardService(LEADERBOARD),
    },
  },
  decorators: [withMockUser()],
});

export const Default = meta.story({
  tags: ["demo"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for data to load, then verify entries
    await waitFor(() => {
      expect(canvas.getByText("Alice Johnson")).toBeInTheDocument();
    });
    expect(canvas.getByText("Tipping Leaderboard")).toBeInTheDocument();
    expect(canvas.getByText("Diana Prince")).toBeInTheDocument();

    // Current user should have "You" badge
    expect(canvas.getByText("You")).toBeInTheDocument();
  },
});

export const Empty = meta.story({
  parameters: {
    services: leaderboardService([]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/No tips have been submitted/)).toBeInTheDocument();
    });
  },
});

export const Loading = meta.story({
  parameters: {
    services: {
      aflService: {
        getLeaderboard: () => new Promise(() => {}),
      },
    },
  },
});

export const Error = meta.story({
  parameters: {
    services: {
      aflService: {
        getLeaderboard: () => Promise.reject(new globalThis.Error("Network error")),
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(canvas.getByText(/Failed to load the leaderboard/)).toBeInTheDocument();
    });
    expect(canvas.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  },
});

export const ErrorThenRetry = meta.story({
  parameters: {
    services: {
      aflService: {
        getLeaderboard: (() => {
          let calls = 0;
          return () => {
            calls++;
            if (calls <= 1) {
              return Promise.reject(new globalThis.Error("Network error"));
            }
            return new Promise((resolve) => setTimeout(() => resolve(LEADERBOARD), 1500));
          };
        })(),
      },
    },
  },
});

export const SingleUser = meta.story({
  parameters: {
    services: leaderboardService([
      createAflLeaderboardEntry({
        userId: "user-storybook",
        displayName: "Solo Tipper",
        correctTips: 5,
        totalMarginDiff: 15,
        score: 5,
      }),
    ]),
  },
});

export const TiedFirstPlace = meta.story({
  parameters: {
    services: leaderboardService([
      createAflLeaderboardEntry({
        userId: "user-1",
        displayName: "Alice Johnson",
        correctTips: 18,
        totalMarginDiff: 12,
        score: 18,
      }),
      createAflLeaderboardEntry({
        userId: "user-2",
        displayName: "Bob Williams",
        correctTips: 18,
        totalMarginDiff: 12,
        score: 18,
      }),
      createAflLeaderboardEntry({
        userId: "user-storybook",
        displayName: "You (Current User)",
        avatarUrl: null,
        correctTips: 14,
        totalMarginDiff: 30,
        score: 14,
      }),
    ]),
  },
});

export const TiedSecondPlace = meta.story({
  parameters: {
    services: leaderboardService([
      createAflLeaderboardEntry({
        userId: "user-1",
        displayName: "Alice Johnson",
        correctTips: 18,
        totalMarginDiff: 10,
        score: 18,
      }),
      createAflLeaderboardEntry({
        userId: "user-2",
        displayName: "Bob Williams",
        correctTips: 15,
        totalMarginDiff: 25,
        score: 15,
      }),
      createAflLeaderboardEntry({
        userId: "user-storybook",
        displayName: "You (Current User)",
        avatarUrl: null,
        correctTips: 15,
        totalMarginDiff: 25,
        score: 15,
      }),
      createAflLeaderboardEntry({
        userId: "user-4",
        displayName: "Charlie Brown",
        correctTips: 10,
        totalMarginDiff: 45,
        score: 10,
      }),
    ]),
  },
});

export const NoGamesCompleted = meta.story({
  parameters: {
    services: leaderboardService([
      createAflLeaderboardEntry({
        userId: "user-1",
        displayName: "Alice Johnson",
        correctTips: 0,
        totalMarginDiff: 0,
        score: 0,
      }),
      createAflLeaderboardEntry({
        userId: "user-2",
        displayName: "Bob Williams",
        correctTips: 0,
        totalMarginDiff: 0,
        score: 0,
      }),
      createAflLeaderboardEntry({
        userId: "user-storybook",
        displayName: "You (Current User)",
        avatarUrl: null,
        correctTips: 0,
        totalMarginDiff: 0,
        score: 0,
      }),
    ]),
  },
});
