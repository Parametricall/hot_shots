import preview, { containerDecorator, withSeason } from "#.storybook/preview";
import {
  SeasonSummaryView,
  type SeasonSummaryViewProps,
} from "~/features/afl-tipping/components/season-summary/season-summary-view";
import type { AflPlayerSeasonStats } from "~/features/afl-tipping/types";
import {
  createAflLeaderboardEntry,
  createAflPlayerRoundStats,
  createAflPlayerStatsEntry,
} from "~/features/afl-tipping/mocks/factories";

function entry(userId: string, displayName: string, score: number, totalMarginDiff = 0) {
  return createAflLeaderboardEntry({
    userId,
    displayName,
    score,
    correctTips: score,
    totalMarginDiff,
  });
}

const LEADERBOARD = [
  entry("u1", "Alice Johnson", 164, 210),
  entry("u2", "Ryan Suspicious", 160, 232),
  entry("user-storybook", "You (Current User)", 158, 240),
  entry("u4", "Charlie Brown", 150, 260),
  entry("u5", "Diana Prince", 141, 301),
  entry("u6", "Evan Wright", 118, 380),
];

const PERFECT = { correctTips: 9, gamesTipped: 9, gamesCompleted: 9, totalGames: 9 };

function stats(
  userId: string,
  displayName: string,
  season: Partial<AflPlayerSeasonStats>,
  rounds = [createAflPlayerRoundStats({ round: 4, correctTips: 6, marginDiff: 20 })],
) {
  return createAflPlayerStatsEntry({ userId, displayName, season, rounds });
}

const PLAYER_STATS = [
  stats(
    "u1",
    "Alice Johnson",
    { accuracy: 71, longestStreak: 11, totalUnderdogs: 14, totalMarginDiff: 210 },
    [
      createAflPlayerRoundStats({ round: 2, ...PERFECT, marginDiff: 12 }),
      createAflPlayerRoundStats({ round: 9, ...PERFECT, marginDiff: 30 }),
    ],
  ),
  stats("u2", "Ryan Suspicious", {
    accuracy: 69,
    longestStreak: 8,
    totalUnderdogs: 14,
    totalMarginDiff: 232,
  }),
  stats("user-storybook", "You (Current User)", {
    accuracy: 68,
    longestStreak: 13,
    totalUnderdogs: 9,
    totalMarginDiff: 180,
  }),
  stats("u4", "Charlie Brown", {
    accuracy: 65,
    longestStreak: 6,
    totalUnderdogs: 5,
    totalMarginDiff: 260,
  }),
];

const BASE: SeasonSummaryViewProps = {
  season: 2026,
  status: "over",
  firstGameAt: Date.UTC(2026, 2, 4, 8, 30),
  activeRoundName: "Round 12",
  leaderboard: LEADERBOARD,
  userId: "user-storybook",
  playerStats: PLAYER_STATS,
  roundNames: { 2: "Round 2", 4: "Round 4", 9: "Round 9" },
};

const meta = preview.meta({
  component: SeasonSummaryView,
  parameters: { layout: "padded" },
  decorators: [withSeason(), containerDecorator("max-w-md")],
});

export const Over = meta.story({ args: BASE });

export const OverNoAwards = meta.story({ args: { ...BASE, playerStats: [] } });

export const OverTiedPodium = meta.story({
  args: {
    ...BASE,
    leaderboard: [
      entry("u1", "Alice Johnson", 164, 210),
      entry("u2", "Ryan Suspicious", 160, 232),
      entry("u3", "Charlie Brown", 160, 232),
      entry("u4", "Diana Prince", 160, 232),
      entry("u5", "Evan Wright", 118, 380),
    ],
    userId: undefined,
  },
});

export const OverSharedWoodenSpoon = meta.story({
  args: {
    ...BASE,
    leaderboard: [...LEADERBOARD, entry("u7", "Frank Castle", 118, 380)],
  },
});

export const OverNoWoodenSpoon = meta.story({
  args: {
    ...BASE,
    leaderboard: LEADERBOARD.slice(0, 3),
  },
});

export const InProgress = meta.story({
  args: { ...BASE, status: "in-progress", userId: "u5" },
});

export const InProgressNoScoresYet = meta.story({
  args: {
    ...BASE,
    status: "in-progress",
    leaderboard: LEADERBOARD.map((e) => ({ ...e, score: 0, correctTips: 0, totalMarginDiff: 0 })),
  },
});

export const Upcoming = meta.story({
  args: {
    ...BASE,
    season: 2027,
    status: "upcoming",
    firstGameAt: Date.UTC(2027, 2, 17, 8, 30),
    activeRoundName: "Opening Round",
    leaderboard: [],
  },
});
