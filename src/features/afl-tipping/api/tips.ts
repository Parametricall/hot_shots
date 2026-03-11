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
    await repo.saveTip(gameId, userId, teamId, margin);
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

  // Build a map of round -> first game (for margin tips)
  const gamesByRound = AflGame.groupByRound(games);
  const firstGameByRound = new Map<number, AflGame>();
  for (const [round, roundGames] of Object.entries(gamesByRound)) {
    const firstGame = AflGame.getFirstGameOfRound(roundGames);
    if (firstGame) {
      firstGameByRound.set(Number(round), firstGame);
    }
  }

  // Map game ID to its round number
  const gameRoundMap = new Map<number, number>();
  for (const game of games) {
    gameRoundMap.set(game.id, game.round);
  }

  // Build a set of first-game IDs and their actual margins
  const firstGameActualMargin = new Map<number, number>();
  for (const [, firstGame] of firstGameByRound) {
    const margin = GameRules.getActualMargin(firstGame);
    if (margin !== null) {
      firstGameActualMargin.set(firstGame.id, margin);
    }
  }

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

    // Compute margin diff for first game of each round (default to 0 if no margin set)
    const actualMargin = firstGameActualMargin.get(tip.game_id);
    if (actualMargin !== undefined) {
      stats.marginDiff += GameRules.calculateMarginDiff(
        tip.margin ?? 0,
        actualMargin,
        tip.tip === winner,
      );
    }
  }

  const userMap = await fetchAllClerkUsers();

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
    const firstGame = AflGame.getFirstGameOfRound(games);
    const marginGameId = firstGame?.id;

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
      const isMarginGame = tip.game_id === marginGameId;

      groupTips.push({
        userId: tip.user_id,
        displayName: userInfo?.displayName ?? "Unknown User",
        avatarUrl: userInfo?.avatarUrl ?? null,
        gameId: tip.game_id,
        hasTipped: true,
        tipTeamId: gameStarted ? tip.tip : null,
        margin: isMarginGame && gameStarted ? (tip.margin ?? 0) : undefined,
        hasMargin: isMarginGame && !gameStarted ? tip.margin != null : undefined,
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
