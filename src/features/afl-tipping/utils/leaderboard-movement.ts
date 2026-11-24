import type { AflPlayerStatsEntry } from "~/features/afl-tipping/types";
import { rankEntries } from "~/features/afl-tipping/utils/afl-season";

/**
 * How Tipsters moved on the Leaderboard in the latest Round, worked out from each Tipster's
 * per-Round stats. Pure, so the Demo runs the same code as production (docs/adr/0004).
 *
 * The "latest Round" is the highest Round with a completed Game, so mid-Round the movement shows
 * the Games finished so far. Movement is the place gained (positive) or lost (negative) between
 * the ranking without that Round and the ranking with it, both ranked from the same stats so
 * they agree with each other. Ranking is the Leaderboard's: Score, then lowest Margin difference,
 * with Tipsters level on both sharing a rank.
 */

export type LeaderboardMovement = {
  /** The latest Round with a completed Game, or null before any. */
  round: number | null;
  /** Places gained since the Round before, by userId. Null with no earlier Round to compare to. */
  movement: Record<string, number | null>;
  /** Each Tipster's Correct tips in `round`, by userId. */
  roundCorrect: Record<string, number>;
};

type Totals = { userId: string; score: number; totalMarginDiff: number };

/** userId to rank, over the rounds `include` keeps. */
function rankBy(
  stats: AflPlayerStatsEntry[],
  include: (round: number) => boolean,
): Record<string, number> {
  const totals: Totals[] = stats.map((entry) => ({
    userId: entry.userId,
    score: entry.rounds.filter((r) => include(r.round)).reduce((sum, r) => sum + r.correctTips, 0),
    totalMarginDiff: entry.rounds
      .filter((r) => include(r.round))
      .reduce((sum, r) => sum + (r.marginDiff ?? 0), 0),
  }));
  totals.sort((a, b) => b.score - a.score || a.totalMarginDiff - b.totalMarginDiff);
  const ranks = rankEntries(totals);
  return Object.fromEntries(totals.map((t, i) => [t.userId, ranks[i]!]));
}

export function leaderboardMovement(stats: AflPlayerStatsEntry[]): LeaderboardMovement {
  const completedRounds = stats.flatMap((entry) =>
    entry.rounds.filter((r) => r.gamesCompleted > 0).map((r) => r.round),
  );
  if (completedRounds.length === 0) return { round: null, movement: {}, roundCorrect: {} };

  const latest = Math.max(...completedRounds);
  const hasEarlierRound = completedRounds.some((round) => round < latest);

  const roundCorrect = Object.fromEntries(
    stats.map((entry) => [
      entry.userId,
      entry.rounds.find((r) => r.round === latest)?.correctTips ?? 0,
    ]),
  );

  if (!hasEarlierRound) {
    return {
      round: latest,
      movement: Object.fromEntries(stats.map((entry) => [entry.userId, null])),
      roundCorrect,
    };
  }

  const after = rankBy(stats, (round) => round <= latest);
  const before = rankBy(stats, (round) => round < latest);
  return {
    round: latest,
    movement: Object.fromEntries(
      stats.map((e) => [e.userId, before[e.userId]! - after[e.userId]!]),
    ),
    roundCorrect,
  };
}
