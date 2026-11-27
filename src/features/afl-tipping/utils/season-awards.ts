import type { AflPlayerRoundStats, AflPlayerStatsEntry } from "~/features/afl-tipping/types";

/**
 * The Season awards: who was best at what, once a Season is over. Pure, so the Demo runs the same
 * code as production (docs/adr/0004). An award is shared by every Tipster level on its best
 * value, and is left out when nobody qualifies or the best value is 0 (nothing to celebrate).
 * Closest Margins is the exception that can be 0: a total of 0 is a perfect score there.
 */

export type SeasonAwardId =
  | "longest-streak"
  | "perfect-rounds"
  | "underdog-tips"
  | "best-round"
  | "closest-margins";

export type SeasonAwardWinner = Pick<AflPlayerStatsEntry, "userId" | "displayName" | "avatarUrl">;

export type SeasonAward = {
  id: SeasonAwardId;
  title: string;
  winners: SeasonAwardWinner[];
  /** The winning value: a count, or for Closest Margins a total in points. */
  value: number;
  /** Best round only: the Round numbers on which the winners reached `value`, ascending. */
  rounds?: number[];
};

/** A Round in which the Tipster tipped every Game and every Tip was a Correct tip. */
export function isPerfectRound(round: AflPlayerRoundStats): boolean {
  return (
    round.totalGames > 0 &&
    round.gamesCompleted === round.totalGames &&
    round.gamesTipped === round.totalGames &&
    round.correctTips === round.totalGames
  );
}

function winnerOf(entry: AflPlayerStatsEntry): SeasonAwardWinner {
  return { userId: entry.userId, displayName: entry.displayName, avatarUrl: entry.avatarUrl };
}

/** Everyone on the best value, or null when nobody is scored, or the best is not above 0. */
function highest(
  stats: AflPlayerStatsEntry[],
  measure: (entry: AflPlayerStatsEntry) => number,
): { winners: AflPlayerStatsEntry[]; value: number } | null {
  if (stats.length === 0) return null;
  const value = Math.max(...stats.map(measure));
  if (value <= 0) return null;
  return { winners: stats.filter((entry) => measure(entry) === value), value };
}

/** The awards that have a winner, in display order. */
export function seasonAwards(stats: AflPlayerStatsEntry[]): SeasonAward[] {
  const awards: SeasonAward[] = [];

  const streak = highest(stats, (entry) => entry.season.longestStreak);
  if (streak) {
    awards.push({
      id: "longest-streak",
      title: "Longest streak",
      winners: streak.winners.map(winnerOf),
      value: streak.value,
    });
  }

  const perfect = highest(stats, (entry) => entry.rounds.filter(isPerfectRound).length);
  if (perfect) {
    awards.push({
      id: "perfect-rounds",
      title: "Most Perfect rounds",
      winners: perfect.winners.map(winnerOf),
      value: perfect.value,
    });
  }

  const underdogs = highest(stats, (entry) => entry.season.totalUnderdogs);
  if (underdogs) {
    awards.push({
      id: "underdog-tips",
      title: "Most Underdog tips",
      winners: underdogs.winners.map(winnerOf),
      value: underdogs.value,
    });
  }

  const bestRound = highest(stats, (entry) =>
    Math.max(0, ...entry.rounds.map((round) => round.correctTips)),
  );
  if (bestRound) {
    const rounds = new Set<number>();
    for (const entry of bestRound.winners) {
      for (const round of entry.rounds) {
        if (round.correctTips === bestRound.value) rounds.add(round.round);
      }
    }
    awards.push({
      id: "best-round",
      title: "Best round",
      winners: bestRound.winners.map(winnerOf),
      value: bestRound.value,
      rounds: [...rounds].sort((a, b) => a - b),
    });
  }

  // Only a Tipster with a Margin difference on some Round qualifies: a Tipster with no Tips
  // would otherwise "win" on a total of 0.
  const withMargins = stats.filter((entry) => entry.rounds.some((r) => r.marginDiff !== null));
  if (withMargins.length > 0) {
    const value = Math.min(...withMargins.map((entry) => entry.season.totalMarginDiff));
    awards.push({
      id: "closest-margins",
      title: "Closest Margins",
      winners: withMargins.filter((e) => e.season.totalMarginDiff === value).map(winnerOf),
      value,
    });
  }

  return awards;
}

/** The awards a Tipster won. */
export function awardsWonBy(awards: SeasonAward[], userId: string | undefined): SeasonAward[] {
  if (userId === undefined) return [];
  return awards.filter((award) => award.winners.some((winner) => winner.userId === userId));
}
