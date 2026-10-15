import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import type {
  AflGroupTipEntry,
  AflLeaderboardEntry,
  AflPlayerStatsEntry,
  AflUserTip,
} from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { createClerkClient } from "@clerk/backend";
import serviceRegistry from "~/app/service-registry";
import { GameRules } from "./game-rules";
import { computePlayerStats } from "./player-stats";
import type { AllTipsRow } from "./tips.repository";
import { findAutoTips, toAutoTipRow } from "./auto-tips";

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

type TipsterInfo = { displayName: string; avatarUrl: string | null; joinedAt: number };

async function fetchTipsterJoinedAt(userId: string): Promise<number> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const user = await clerkClient.users.getUser(userId);
  return user.createdAt;
}

async function fetchAllClerkUsers(): Promise<Map<string, TipsterInfo>> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const BATCH_SIZE = 100;
  const userMap = new Map<string, TipsterInfo>();
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
        joinedAt: user.createdAt,
      });
    }
    hasMore = users.length === BATCH_SIZE;
    offset += BATCH_SIZE;
  }

  return userMap;
}

export const submitTip = createServerFn({ method: "POST" })
  .validator(SubmitTipSchema)
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
  .validator(GetTipsSchema)
  .handler(async ({ data }): Promise<AflUserTip[]> => {
    const { gameIds } = data;
    const userId = await ensureUserAuthenticated();

    const { getTipsByUser } = serviceRegistry.getService("tipsRepository");
    const { getGames } = serviceRegistry.getService("squiggleService");

    const [storedTips, allGames, joinedAt] = await Promise.all([
      getTipsByUser(userId, gameIds),
      getGames(),
      fetchTipsterJoinedAt(userId),
    ]);

    const autoTips = findAutoTips({
      games: allGames.filter((g) => gameIds.includes(g.id)),
      tips: storedTips.map((t) => ({ game_id: t.gameId, user_id: userId })),
      joinedAtByTipster: new Map([[userId, joinedAt]]),
      now: Date.now(),
    }).map((a): AflUserTip => ({ gameId: a.gameId, tipTeamId: a.tipTeamId, isAutoTip: true }));

    return [...storedTips, ...autoTips];
  });

/** Stored tips plus the Auto-tips owed to Tipsters who missed a started Game. */
function withAutoTips(
  tips: AllTipsRow[],
  games: AflGame.Type[],
  userMap: Map<string, TipsterInfo>,
): AllTipsRow[] {
  const joinedAtByTipster = new Map([...userMap].map(([id, u]) => [id, u.joinedAt]));
  const gamesById = new Map(games.map((g) => [g.id, g]));
  const autoTipRows = findAutoTips({
    games,
    tips,
    joinedAtByTipster,
    now: Date.now(),
  }).map((a) => toAutoTipRow(a, gamesById.get(a.gameId)!));
  return [...tips, ...autoTipRows];
}

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
  userMap: Map<string, TipsterInfo>,
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
  const storedTips: AllTipsRow[] = await repo.getAllTips();

  const { getGames } = serviceRegistry.getService("squiggleService");
  const games: AflGame.Type[] = await getGames();
  const userMap = await fetchAllClerkUsers();

  const allTips = withAutoTips(storedTips, games, userMap);
  const completedGameWinners = buildCompletedGameWinners(games);
  const firstGameMargins = buildFirstGameMargins(games);
  const userStats = scoreTips(allTips, completedGameWinners, firstGameMargins);

  return assembleLeaderboard(userMap, userStats);
});

const GetGroupTipsSchema = z.object({
  round: z.number(),
});

function buildTippedEntries(
  allTips: AllTipsRow[],
  userMap: Map<string, TipsterInfo>,
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
      isAutoTip: tip.is_auto_tip === true,
      margin: isMarginGame && gameStarted ? (tip.margin ?? 0) : undefined,
      hasMargin: isMarginGame && !gameStarted ? tip.margin != null : undefined,
    };
  });
}

function buildUntippedEntries(
  gameIds: number[],
  allTips: AllTipsRow[],
  userMap: Map<string, TipsterInfo>,
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
  .validator(GetGroupTipsSchema)
  .handler(async ({ data }): Promise<AflGroupTipEntry[]> => {
    await ensureUserAuthenticated();

    const { round } = data;
    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames(round);

    const gameIds = games.map((g) => g.id);
    const startedGameIds = new Set(games.filter((g) => AflGame.hasStarted(g)).map((g) => g.id));
    const marginGameId = AflGame.getFirstGameOfRound(games)?.id;

    const repo = serviceRegistry.getService("tipsRepository");
    const storedTips = await repo.getTipsByGameIds(gameIds);
    const userMap = await fetchAllClerkUsers();
    const allTips = withAutoTips(storedTips, games, userMap);

    return [
      ...buildTippedEntries(allTips, userMap, startedGameIds, marginGameId),
      ...buildUntippedEntries(gameIds, allTips, userMap),
    ];
  });

export const getPlayerStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<AflPlayerStatsEntry[]> => {
    await ensureUserAuthenticated();

    const repo = serviceRegistry.getService("tipsRepository");
    const storedTips: AllTipsRow[] = await repo.getAllTips();

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames();
    const userMap = await fetchAllClerkUsers();

    const allTips = withAutoTips(storedTips, games, userMap);
    const { byUser, makeEmptyStats } = computePlayerStats(allTips, games);

    const entries = Array.from(userMap.entries()).map(([userId, userInfo]) => ({
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
  },
);

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
  getGroupTips,
  getPlayerStats,
};
