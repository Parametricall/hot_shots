import type { AflPlayerRoundStats, AflPlayerSeasonStats } from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { GameRules } from "./game-rules";
import type { AllTipsRow } from "./tips.repository";

export type PlayerStatsTip = Pick<
  AllTipsRow,
  "game_id" | "user_id" | "tip" | "margin" | "is_underdog"
>;

export type PlayerStatsResult = {
  season: AflPlayerSeasonStats;
  rounds: AflPlayerRoundStats[];
};

type RoundMeta = {
  round: number;
  isFinals: boolean;
  gamesCompleted: number;
  totalGames: number;
  marginGameId: number | undefined;
  actualMargin: number | null;
};

function buildRoundMeta(tips: PlayerStatsTip[], games: AflGame.Type[]): RoundMeta[] {
  const gameRound = new Map(games.map((g) => [g.id, g.round]));

  // Show rounds that have at least one completed game, plus the in-progress round
  // once underdog-tracked tips exist for it (mirrors the old compliance view).
  const roundsToShow = new Set<number>();
  for (const game of games) {
    if (AflGame.isComplete(game)) roundsToShow.add(game.round);
  }
  for (const tip of tips) {
    if (tip.is_underdog == null) continue;
    const round = gameRound.get(tip.game_id);
    if (round != null) roundsToShow.add(round);
  }

  const gamesByRound = AflGame.groupByRound(games);
  return [...roundsToShow]
    .sort((a, b) => a - b)
    .map((round) => {
      const roundGames = gamesByRound[round] ?? [];
      const marginGame = AflGame.getFirstGameOfRound(roundGames);
      return {
        round,
        isFinals: roundGames.some((g) => g.isFinals),
        gamesCompleted: roundGames.filter(AflGame.isComplete).length,
        marginGameId: marginGame?.id,
        actualMargin: marginGame ? GameRules.getActualMargin(marginGame) : null,
        totalGames: roundGames.length,
      };
    });
}

function computeStreaks(
  completedGamesInOrder: AflGame.Type[],
  tipsByGame: Map<number, PlayerStatsTip>,
): { currentStreak: number; longestStreak: number } {
  let run = 0;
  let longest = 0;
  for (const game of completedGamesInOrder) {
    const tip = tipsByGame.get(game.id);
    // A game the user didn't tip neither extends nor breaks the streak
    if (!tip) continue;
    if (tip.tip === game.winnerTeamId) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  return { currentStreak: run, longestStreak: longest };
}

export function computePlayerStats(tips: PlayerStatsTip[], games: AflGame.Type[]) {
  const gameRound = new Map(games.map((g) => [g.id, g.round]));
  const winners = new Map<number, number | null>();
  for (const game of games) {
    if (AflGame.isComplete(game)) winners.set(game.id, game.winnerTeamId);
  }

  const roundMeta = buildRoundMeta(tips, games);
  const roundIndex = new Map(roundMeta.map((meta, i) => [meta.round, i]));
  const totalGamesCompleted = roundMeta.reduce((sum, meta) => sum + meta.gamesCompleted, 0);
  const completedGamesInOrder = AflGame.sortByDate(games.filter(AflGame.isComplete));

  const makeEmptyStats = (): PlayerStatsResult => ({
    season: {
      correctTips: 0,
      gamesTipped: 0,
      gamesCompleted: totalGamesCompleted,
      accuracy: null,
      totalMarginDiff: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalUnderdogs: 0,
    },
    rounds: roundMeta.map((meta) => ({
      round: meta.round,
      isFinals: meta.isFinals,
      correctTips: 0,
      gamesTipped: 0,
      gamesCompleted: meta.gamesCompleted,
      totalGames: meta.totalGames,
      marginDiff: null,
      underdogCount: 0,
      meetsMinimum: meta.isFinals,
    })),
  });

  const byUser = new Map<string, PlayerStatsResult>();
  const tipsByUserByGame = new Map<string, Map<number, PlayerStatsTip>>();
  const ensureUser = (userId: string): PlayerStatsResult => {
    let entry = byUser.get(userId);
    if (!entry) {
      entry = makeEmptyStats();
      byUser.set(userId, entry);
      tipsByUserByGame.set(userId, new Map());
    }
    return entry;
  };

  for (const tip of tips) {
    const round = gameRound.get(tip.game_id);
    if (round == null) continue;

    const entry = ensureUser(tip.user_id);
    tipsByUserByGame.get(tip.user_id)!.set(tip.game_id, tip);

    const index = roundIndex.get(round);
    const roundStats = index != null ? entry.rounds[index] : undefined;
    const meta = index != null ? roundMeta[index] : undefined;
    if (!roundStats || !meta) continue;

    if (tip.is_underdog === true) {
      roundStats.underdogCount += 1;
      entry.season.totalUnderdogs += 1;
    }

    const winner = winners.get(tip.game_id);
    if (winner !== undefined) {
      roundStats.gamesTipped += 1;
      entry.season.gamesTipped += 1;
      if (tip.tip === winner) {
        roundStats.correctTips += 1;
        entry.season.correctTips += 1;
      }
    }

    if (meta.marginGameId === tip.game_id && meta.actualMargin !== null) {
      const diff = GameRules.calculateMarginDiff(
        tip.margin ?? 0,
        meta.actualMargin,
        tip.tip === winner,
      );
      roundStats.marginDiff = diff;
      entry.season.totalMarginDiff += diff;
    }
  }

  for (const [userId, entry] of byUser) {
    for (const roundStats of entry.rounds) {
      roundStats.meetsMinimum =
        roundStats.isFinals || roundStats.underdogCount >= GameRules.MINIMUM_UNDERDOGS_PER_ROUND;
    }
    entry.season.accuracy =
      entry.season.gamesTipped > 0
        ? (entry.season.correctTips / entry.season.gamesTipped) * 100
        : null;
    const streaks = computeStreaks(completedGamesInOrder, tipsByUserByGame.get(userId)!);
    entry.season.currentStreak = streaks.currentStreak;
    entry.season.longestStreak = streaks.longestStreak;
  }

  return { byUser, makeEmptyStats };
}
