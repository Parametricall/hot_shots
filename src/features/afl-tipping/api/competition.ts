import type {
  AflGroupTipEntry,
  AflLeaderboardEntry,
  AflModelTip,
  AflPlayerStatsEntry,
  AflUserTip,
} from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { findAutoTips, toAutoTipRow } from "./auto-tips";
import { GameRules } from "./game-rules";
import { computePlayerStats } from "./player-stats";
import type { AllTipsRow } from "./tips.repository";

/**
 * The Competition's rules as pure functions: Lockout, Auto-tips, the
 * Leaderboard, Group Tips and player stats. Every input is explicit, including
 * `now`, so the same code runs in the server functions (`tips.ts`) and in the
 * Demo's `aflServiceDemo` (docs/adr/0004), and a unit test can pin it. Nothing
 * here may import the session, Supabase or the service registry.
 */

export type Tipster = { displayName: string; avatarUrl: string | null; joinedAt: number };
export type Tipsters = Map<string, Tipster>; // by user id

type TipStats = { correct: number; marginDiff: number };

export type JudgeTipResult =
  | { ok: true; isUnderdog: boolean | undefined }
  | { ok: false; reason: "game-not-found" | "game-started" };

/** What the server functions and the Demo throw for each rejection. */
export const TIP_REJECTION_MESSAGES = {
  "game-not-found": "Game not found in Squiggle API",
  "game-started": "Cannot submit tip after the game has started",
} as const satisfies Record<Extract<JudgeTipResult, { ok: false }>["reason"], string>;

/**
 * Whether a Tip may be saved, and whether it is an Underdog tip: a Tip against
 * the Model tip. `isUnderdog` is `undefined` when the Game has no Model tip.
 */
export function judgeTip(args: {
  game: AflGame.Type | undefined;
  teamId: number;
  modelTip: AflModelTip | undefined;
  now: number;
}): JudgeTipResult {
  const { game, teamId, modelTip, now } = args;
  if (!game) return { ok: false, reason: "game-not-found" };
  if (!GameRules.canSubmitTip({ game, now })) return { ok: false, reason: "game-started" };
  const isUnderdog = modelTip?.tipTeamId != null ? teamId !== modelTip.tipTeamId : undefined;
  return { ok: true, isUnderdog };
}

/** The Tipster's stored Tips plus the Auto-tips owed for the same Games. */
export function buildTipsterTips(args: {
  storedTips: AflUserTip[];
  games: AflGame.Type[];
  gameIds: number[];
  userId: string;
  joinedAt: number;
  now: number;
}): AflUserTip[] {
  const { storedTips, games, gameIds, userId, joinedAt, now } = args;
  const autoTips = findAutoTips({
    games: games.filter((g) => gameIds.includes(g.id)),
    tips: storedTips.map((t) => ({ game_id: t.gameId, user_id: userId })),
    joinedAtByTipster: new Map([[userId, joinedAt]]),
    now,
  }).map((a): AflUserTip => ({ gameId: a.gameId, tipTeamId: a.tipTeamId, isAutoTip: true }));

  return [...storedTips, ...autoTips];
}

/** Stored tips plus the Auto-tips owed to Tipsters who missed a started Game. */
export function withAutoTips(
  tips: AllTipsRow[],
  games: AflGame.Type[],
  tipsters: Tipsters,
  now: number,
): AllTipsRow[] {
  const joinedAtByTipster = new Map([...tipsters].map(([id, u]) => [id, u.joinedAt]));
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const autoTipRows = findAutoTips({
    games,
    tips,
    joinedAtByTipster,
    now,
  }).map((a) => toAutoTipRow(a, gamesById.get(a.gameId)!));
  return [...tips, ...autoTipRows];
}

export function buildCompletedGameWinners(games: AflGame.Type[]): Map<number, number | null> {
  const winners = new Map<number, number | null>();
  for (const game of games) {
    if (AflGame.isComplete(game)) {
      winners.set(game.id, game.winnerTeamId);
    }
  }
  return winners;
}

export function buildFirstGameMargins(games: AflGame.Type[]): Map<number, number> {
  const margins = new Map<number, number>();
  const gamesByRound = AflGame.groupByRound(games);
  for (const [, roundGames] of Object.entries(gamesByRound)) {
    const firstGame = AflGame.getFirstGameOfRound(roundGames);
    if (!firstGame) continue;
    const margin = GameRules.getActualMargin(firstGame);
    if (margin !== null) {
      margins.set(firstGame.id, margin);
    }
  }
  return margins;
}

export function scoreTips(
  allTips: AllTipsRow[],
  completedGameWinners: Map<number, number | null>,
  firstGameMargins: Map<number, number>,
): Map<string, TipStats> {
  const userStats = new Map<string, TipStats>();
  for (const tip of allTips) {
    if (!userStats.has(tip.user_id)) {
      userStats.set(tip.user_id, { correct: 0, marginDiff: 0 });
    }

    const winner = completedGameWinners.get(tip.game_id);
    if (winner === undefined) continue;

    const stats = userStats.get(tip.user_id)!;
    if (tip.tip === winner) {
      stats.correct += 1;
    }

    const actualMargin = firstGameMargins.get(tip.game_id);
    if (actualMargin !== undefined) {
      stats.marginDiff += GameRules.calculateMarginDiff(
        tip.margin ?? 0,
        actualMargin,
        tip.tip === winner,
      );
    }
  }
  return userStats;
}

export function assembleLeaderboard(
  tipsters: Tipsters,
  userStats: Map<string, TipStats>,
): AflLeaderboardEntry[] {
  const leaderboard: AflLeaderboardEntry[] = Array.from(tipsters.entries()).map(
    ([userId, userInfo]) => {
      const stats = userStats.get(userId) ?? { correct: 0, marginDiff: 0 };
      return {
        userId,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        correctTips: stats.correct,
        totalMarginDiff: stats.marginDiff,
        score: stats.correct,
      };
    },
  );

  leaderboard.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalMarginDiff - b.totalMarginDiff;
  });

  return leaderboard;
}

/** Ranked by Score, then by the lowest total Margin difference. */
export function buildLeaderboard(args: {
  tips: AllTipsRow[];
  games: AflGame.Type[];
  tipsters: Tipsters;
  now: number;
}): AflLeaderboardEntry[] {
  const { tips, games, tipsters, now } = args;
  const allTips = withAutoTips(tips, games, tipsters, now);
  const userStats = scoreTips(
    allTips,
    buildCompletedGameWinners(games),
    buildFirstGameMargins(games),
  );
  return assembleLeaderboard(tipsters, userStats);
}

export function buildTippedEntries(
  allTips: AllTipsRow[],
  tipsters: Tipsters,
  startedGameIds: Set<number>,
  marginGameId: number | undefined,
): AflGroupTipEntry[] {
  return allTips.map((tip) => {
    const userInfo = tipsters.get(tip.user_id);
    const gameStarted = startedGameIds.has(tip.game_id);
    const isMarginGame = tip.game_id === marginGameId;

    return {
      userId: tip.user_id,
      displayName: userInfo?.displayName ?? "Unknown User",
      avatarUrl: userInfo?.avatarUrl ?? null,
      gameId: tip.game_id,
      hasTipped: true,
      tipTeamId: gameStarted ? tip.tip : null,
      isAutoTip: tip.is_auto_tip === true,
      margin: isMarginGame && gameStarted ? (tip.margin ?? 0) : undefined,
      hasMargin: isMarginGame && !gameStarted ? tip.margin != null : undefined,
    };
  });
}

export function buildUntippedEntries(
  gameIds: number[],
  allTips: AllTipsRow[],
  tipsters: Tipsters,
): AflGroupTipEntry[] {
  const tippedUsersByGame = new Map<number, Set<string>>();
  for (const gameId of gameIds) {
    tippedUsersByGame.set(gameId, new Set());
  }
  for (const tip of allTips) {
    tippedUsersByGame.get(tip.game_id)?.add(tip.user_id);
  }

  const entries: AflGroupTipEntry[] = [];
  for (const gameId of gameIds) {
    const tippedUsers = tippedUsersByGame.get(gameId)!;
    for (const [userId, userInfo] of tipsters) {
      if (!tippedUsers.has(userId)) {
        entries.push({
          userId,
          displayName: userInfo.displayName,
          avatarUrl: userInfo.avatarUrl,
          gameId,
          hasTipped: false,
          tipTeamId: null,
        });
      }
    }
  }
  return entries;
}

/** One Round's Tips. Other Tipsters' teams and Margins stay hidden until Lockout. */
export function buildGroupTips(args: {
  tips: AllTipsRow[];
  roundGames: AflGame.Type[];
  tipsters: Tipsters;
  now: number;
}): AflGroupTipEntry[] {
  const { tips, roundGames, tipsters, now } = args;
  const gameIds = roundGames.map((g) => g.id);
  const startedGameIds = new Set(
    roundGames.filter((g) => AflGame.hasStarted(g, now)).map((g) => g.id),
  );
  const marginGameId = AflGame.getFirstGameOfRound(roundGames)?.id;
  const allTips = withAutoTips(tips, roundGames, tipsters, now);

  return [
    ...buildTippedEntries(allTips, tipsters, startedGameIds, marginGameId),
    ...buildUntippedEntries(gameIds, allTips, tipsters),
  ];
}

/** Every Tipster's season and per-Round stats, ranked like the Leaderboard. */
export function buildPlayerStats(args: {
  tips: AllTipsRow[];
  games: AflGame.Type[];
  tipsters: Tipsters;
  now: number;
}): AflPlayerStatsEntry[] {
  const { tips, games, tipsters, now } = args;
  const allTips = withAutoTips(tips, games, tipsters, now);
  const { byUser, makeEmptyStats } = computePlayerStats(allTips, games);

  const entries = Array.from(tipsters.entries()).map(([userId, userInfo]) => ({
    userId,
    displayName: userInfo.displayName,
    avatarUrl: userInfo.avatarUrl,
    ...(byUser.get(userId) ?? makeEmptyStats()),
  }));

  entries.sort((a, b) => {
    if (b.season.correctTips !== a.season.correctTips) {
      return b.season.correctTips - a.season.correctTips;
    }
    return a.season.totalMarginDiff - b.season.totalMarginDiff;
  });

  return entries;
}
