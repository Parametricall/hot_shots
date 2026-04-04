import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import type {
  AflGroupTipEntry,
  AflLeaderboardEntry,
  AflUserTip,
} from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import serviceRegistry from "~/app/service-registry";
import { ensureAuthenticated } from "~/lib/auth";
import { fetchAllClerkUsers } from "~/lib/clerk";
import { GameRules } from "./game-rules";
import type { AllTipsRow } from "./tips.repository";

const SubmitTipSchema = z.object({
  gameId: z.number(), // Squiggle game id
  teamId: z.number(), // Squiggle team id
  margin: z.number().min(0).max(200).optional(),
});

const GetTipsSchema = z.object({
  gameIds: z.array(z.number()),
});

export const submitTip = createServerFn({ method: "POST" })
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId, margin } = data;
    const userId = await ensureAuthenticated();

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames();
    const game = games.find((g) => g.id === gameId);
    // Use 'date' as the start time property (Squiggle API)
    const startTime = game?.date as string | undefined;
    if (!game || !startTime) {
      throw new Error("Game not found in Squiggle API");
    }
    // Use gameRules abstraction
    if (!GameRules.canSubmitTip({ game })) {
      throw new Error("Cannot submit tip after the game has started");
    }

    const repo = serviceRegistry.getService("tipsRepository");
    await repo.saveTip(gameId, userId, teamId, margin);
    return { success: true };
  });

export const getTips = createServerFn({ method: "GET" })
  .inputValidator(GetTipsSchema)
  .handler(async ({ data }): Promise<AflUserTip[]> => {
    const { gameIds } = data;
    const userId = await ensureAuthenticated();

    const { getTipsByUser } = serviceRegistry.getService("tipsRepository");

    return await getTipsByUser(userId, gameIds);
  });

function buildCompletedGameWinners(games: AflGame.Type[]): Map<number, number | null> {
  const winners = new Map<number, number | null>();
  for (const game of games) {
    if (AflGame.isComplete(game)) {
      winners.set(game.id, game.winnerTeamId);
    }
  }
  return winners;
}

function buildFirstGameMargins(games: AflGame.Type[]): Map<number, number> {
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

function scoreTips(
  allTips: AllTipsRow[],
  completedGameWinners: Map<number, number | null>,
  firstGameMargins: Map<number, number>,
): Map<string, { correct: number; marginDiff: number }> {
  const userStats = new Map<string, { correct: number; marginDiff: number }>();
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

function assembleLeaderboard(
  userMap: Map<string, { displayName: string; avatarUrl: string | null }>,
  userStats: Map<string, { correct: number; marginDiff: number }>,
): AflLeaderboardEntry[] {
  const leaderboard: AflLeaderboardEntry[] = Array.from(userMap.entries()).map(
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

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  await ensureAuthenticated();

  const repo = serviceRegistry.getService("tipsRepository");
  const allTips: AllTipsRow[] = await repo.getAllTips();

  const { getGames } = serviceRegistry.getService("squiggleService");
  const games: AflGame.Type[] = await getGames();

  const completedGameWinners = buildCompletedGameWinners(games);
  const firstGameMargins = buildFirstGameMargins(games);
  const userStats = scoreTips(allTips, completedGameWinners, firstGameMargins);
  const userMap = await fetchAllClerkUsers();

  return assembleLeaderboard(userMap, userStats);
});

const GetGroupTipsSchema = z.object({
  round: z.number(),
});

function buildTippedEntries(
  allTips: AllTipsRow[],
  userMap: Map<string, { displayName: string; avatarUrl: string | null }>,
  startedGameIds: Set<number>,
  marginGameId: number | undefined,
): AflGroupTipEntry[] {
  return allTips.map((tip) => {
    const userInfo = userMap.get(tip.user_id);
    const gameStarted = startedGameIds.has(tip.game_id);
    const isMarginGame = tip.game_id === marginGameId;

    return {
      userId: tip.user_id,
      displayName: userInfo?.displayName ?? "Unknown User",
      avatarUrl: userInfo?.avatarUrl ?? null,
      gameId: tip.game_id,
      hasTipped: true,
      tipTeamId: gameStarted ? tip.tip : null,
      margin: isMarginGame && gameStarted ? (tip.margin ?? 0) : undefined,
      hasMargin: isMarginGame && !gameStarted ? tip.margin != null : undefined,
    };
  });
}

function buildUntippedEntries(
  gameIds: number[],
  allTips: AllTipsRow[],
  userMap: Map<string, { displayName: string; avatarUrl: string | null }>,
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
    for (const [userId, userInfo] of userMap) {
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

export const getGroupTips = createServerFn({ method: "GET" })
  .inputValidator(GetGroupTipsSchema)
  .handler(async ({ data }): Promise<AflGroupTipEntry[]> => {
    await ensureAuthenticated();

    const { round } = data;
    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames(round);

    const gameIds = games.map((g) => g.id);
    const startedGameIds = new Set(games.filter((g) => AflGame.hasStarted(g)).map((g) => g.id));
    const marginGameId = AflGame.getFirstGameOfRound(games)?.id;

    const repo = serviceRegistry.getService("tipsRepository");
    const allTips = await repo.getTipsByGameIds(gameIds);
    const userMap = await fetchAllClerkUsers();

    return [
      ...buildTippedEntries(allTips, userMap, startedGameIds, marginGameId),
      ...buildUntippedEntries(gameIds, allTips, userMap),
    ];
  });

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
  getGroupTips,
};
