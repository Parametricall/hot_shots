import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import {
  AflUserTip,
  AflGame,
  AflLeaderboardEntry,
  AflGroupTipEntry,
} from "~/features/afl-tipping/types";
import { createClerkClient } from "@clerk/backend";
import serviceRegistry from "~/service-registry";
import { GameRules } from "./game-rules";
import type { AllTipsRow } from "./tips.repository";

const SubmitTipSchema = z.object({
  gameId: z.number(), // Squiggle game id
  teamId: z.number(), // Squiggle team id
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
    const { gameId, teamId } = data;
    const userId = await ensureUserAuthenticated();

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame[] = await getGames();
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
    await repo.saveTip(gameId, userId, teamId);
    return { success: true };
  });

export const getTips = createServerFn({ method: "GET" })
  .inputValidator(GetTipsSchema)
  .handler(async ({ data }) => {
    const { gameIds } = data;
    const userId = await ensureUserAuthenticated();

    const repo = serviceRegistry.getService("tipsRepository");
    const result: AflUserTip[] = await repo.getTipsByUser(userId, gameIds);
    return result;
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  await ensureUserAuthenticated();

  const repo = serviceRegistry.getService("tipsRepository");
  const allTips: AllTipsRow[] = await repo.getAllTips();

  const { getGames } = serviceRegistry.getService("squiggleService");
  const games: AflGame[] = await getGames();
  const completedGameWinners = new Map<number, number | null>();
  for (const game of games) {
    if (AflGame.isComplete(game)) {
      completedGameWinners.set(game.id, game.winnerTeamId);
    }
  }

  const userStats = new Map<string, { correct: number; total: number }>();
  for (const tip of allTips) {
    if (!userStats.has(tip.user_id)) {
      userStats.set(tip.user_id, { correct: 0, total: 0 });
    }

    const winner = completedGameWinners.get(tip.game_id);
    if (winner === undefined) continue;

    const stats = userStats.get(tip.user_id)!;
    stats.total += 1;
    if (tip.tip === winner) {
      stats.correct += 1;
    }
  }

  const userMap = await fetchAllClerkUsers();

  const leaderboard: AflLeaderboardEntry[] = Array.from(userMap.entries()).map(
    ([userId, userInfo]) => {
      const stats = userStats.get(userId) ?? { correct: 0, total: 0 };
      return {
        userId,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        correctTips: stats.correct,
        totalTips: stats.total,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0,
      };
    },
  );

  leaderboard.sort((a, b) => {
    if (b.correctTips !== a.correctTips) return b.correctTips - a.correctTips;
    return b.accuracy - a.accuracy;
  });

  return leaderboard;
});

const GetGroupTipsSchema = z.object({
  round: z.number(),
});

export const getGroupTips = createServerFn({ method: "GET" })
  .inputValidator(GetGroupTipsSchema)
  .handler(async ({ data }) => {
    await ensureUserAuthenticated();

    const { round } = data;
    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame[] = await getGames(round);

    const gameIds = games.map((g) => g.id);
    const startedGameIds = new Set(games.filter((g) => AflGame.hasStarted(g)).map((g) => g.id));

    const repo = serviceRegistry.getService("tipsRepository");
    const allTips = await repo.getTipsByGameIds(gameIds);

    const userMap = await fetchAllClerkUsers();

    // Build set of user IDs who tipped each game
    const tippedUsersByGame = new Map<number, Set<string>>();
    for (const gameId of gameIds) {
      tippedUsersByGame.set(gameId, new Set());
    }
    for (const tip of allTips) {
      tippedUsersByGame.get(tip.game_id)?.add(tip.user_id);
    }

    const groupTips: AflGroupTipEntry[] = [];

    // Add entries for users who tipped
    for (const tip of allTips) {
      const userInfo = userMap.get(tip.user_id);
      const gameStarted = startedGameIds.has(tip.game_id);

      groupTips.push({
        userId: tip.user_id,
        displayName: userInfo?.displayName ?? "Unknown User",
        avatarUrl: userInfo?.avatarUrl ?? null,
        gameId: tip.game_id,
        hasTipped: true,
        tipTeamId: gameStarted ? tip.tip : null,
      });
    }

    // Add entries for users who haven't tipped each game
    for (const gameId of gameIds) {
      const tippedUsers = tippedUsersByGame.get(gameId)!;
      for (const [userId, userInfo] of userMap) {
        if (!tippedUsers.has(userId)) {
          groupTips.push({
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

    return groupTips;
  });

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
  getGroupTips,
};
