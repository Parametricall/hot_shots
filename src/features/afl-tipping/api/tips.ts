import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import type {
  AflGroupTipEntry,
  AflLeaderboardEntry,
  AflUnderdogComplianceEntry,
  AflUserTip,
} from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { createClerkClient } from "@clerk/backend";
import serviceRegistry from "~/app/service-registry";
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

async function ensureUserAuthenticated(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

async function fetchAllClerkUsers(): Promise<
  Map<string, { displayName: string; avatarUrl: string | null }>
> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const BATCH_SIZE = 100;
  const userMap = new Map<string, { displayName: string; avatarUrl: string | null }>();
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: users } = await clerkClient.users.getUserList({
      limit: BATCH_SIZE,
      offset,
    });
    for (const user of users) {
      userMap.set(user.id, {
        displayName:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.emailAddresses[0]?.emailAddress ||
          "Unknown User",
        avatarUrl: user.imageUrl ?? null,
      });
    }
    hasMore = users.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  return userMap;
}

export const submitTip = createServerFn({ method: "POST" })
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId, margin } = data;
    try {
      const userId = await ensureUserAuthenticated();

      const { getGames, getModelTips } = serviceRegistry.getService("squiggleService");
      const games: AflGame.Type[] = await getGames();

      const game = games.find((g) => g.id === gameId);
      const startTime = game?.date as string | undefined;
      if (!game || !startTime) {
        console.error("[submitTip] game not found", { gameId });
        throw new Error("Game not found in Squiggle API");
      }
      if (!GameRules.canSubmitTip({ game })) {
        console.warn("[submitTip] game already started", { gameId, startTime });
        throw new Error("Cannot submit tip after the game has started");
      }

      const modelTips = await getModelTips(game.round);
      const modelTip = modelTips.find((t) => t.gameId === gameId);
      const isUnderdog = modelTip?.tipTeamId != null ? teamId !== modelTip.tipTeamId : undefined;

      const repo = serviceRegistry.getService("tipsRepository");
      await repo.saveTip(gameId, userId, teamId, margin, isUnderdog);
      return { success: true };
    } catch (err) {
      console.error("[submitTip] failed", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        cause: err instanceof Error ? err.cause : undefined,
      });
      throw err;
    }
  });

export const getTips = createServerFn({ method: "GET" })
  .inputValidator(GetTipsSchema)
  .handler(async ({ data }): Promise<AflUserTip[]> => {
    const { gameIds } = data;
    const userId = await ensureUserAuthenticated();

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
  await ensureUserAuthenticated();

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
    await ensureUserAuthenticated();

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

export const getUnderdogCompliance = createServerFn({ method: "GET" }).handler(
  async (): Promise<AflUnderdogComplianceEntry[]> => {
    await ensureUserAuthenticated();

    const repo = serviceRegistry.getService("tipsRepository");
    const allTips: AllTipsRow[] = await repo.getAllTips();

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames();

    // Build gameId -> round lookup
    const gameRoundMap = new Map<number, number>();
    for (const game of games) {
      gameRoundMap.set(game.id, game.round);
    }

    // Determine which rounds are finals
    const gamesByRound = AflGame.groupByRound(games);
    const finalsRounds = new Set<number>();
    for (const [roundStr, roundGames] of Object.entries(gamesByRound)) {
      if (GameRules.isFinals(roundGames)) {
        finalsRounds.add(Number(roundStr));
      }
    }

    // Group tips by (userId, round), only include tips with non-null is_underdog
    const userRoundStats = new Map<string, Map<number, number>>();
    const roundsWithTracking = new Set<number>();

    for (const tip of allTips) {
      if (tip.is_underdog == null) continue;

      const round = gameRoundMap.get(tip.game_id);
      if (round == null) continue;

      roundsWithTracking.add(round);

      if (!userRoundStats.has(tip.user_id)) {
        userRoundStats.set(tip.user_id, new Map());
      }
      const roundMap = userRoundStats.get(tip.user_id)!;
      const current = roundMap.get(round) ?? 0;
      roundMap.set(round, current + (tip.is_underdog ? 1 : 0));
    }

    const userMap = await fetchAllClerkUsers();

    // Build compliance entries for all users
    const sortedRounds = [...roundsWithTracking].sort((a, b) => a - b);

    return Array.from(userMap.entries()).map(([userId, userInfo]) => {
      const roundMap = userRoundStats.get(userId);
      return {
        userId,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        rounds: sortedRounds.map((round) => {
          const underdogCount = roundMap?.get(round) ?? 0;
          const isFinals = finalsRounds.has(round);
          return {
            round,
            underdogCount,
            meetsMinimum: isFinals || underdogCount >= GameRules.MINIMUM_UNDERDOGS_PER_ROUND,
            isFinals,
          };
        }),
      };
    });
  },
);

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
  getGroupTips,
  getUnderdogCompliance,
};
