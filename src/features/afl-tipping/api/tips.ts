import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import type {
  AflGroupTipEntry,
  AflPlayerStatsEntry,
  AflUserTip,
} from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { createClerkClient } from "@clerk/backend";
import serviceRegistry from "~/app/service-registry";
import type { AllTipsRow } from "./tips.repository";
import {
  TIP_REJECTION_MESSAGES,
  buildGroupTips,
  buildLeaderboard,
  buildPlayerStats,
  buildTipsterTips,
  judgeTip,
  type Tipster,
  type Tipsters,
} from "./competition";

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

async function fetchTipsterJoinedAt(userId: string): Promise<number> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });
  const user = await clerkClient.users.getUser(userId);
  return user.createdAt;
}

async function fetchAllClerkUsers(): Promise<Tipsters> {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  const BATCH_SIZE = 100;
  const userMap = new Map<string, Tipster>();
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
      const modelTips = game ? await getModelTips(game.round) : [];
      const modelTip = modelTips.find((t) => t.gameId === gameId);

      const verdict = judgeTip({ game, teamId, modelTip, now: Date.now() });
      if (!verdict.ok) {
        console.warn("[submitTip] tip rejected", { gameId, reason: verdict.reason });
        throw new Error(TIP_REJECTION_MESSAGES[verdict.reason]);
      }

      const repo = serviceRegistry.getService("tipsRepository");
      await repo.saveTip(gameId, userId, teamId, margin, verdict.isUnderdog);
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

    const [storedTips, games, joinedAt] = await Promise.all([
      getTipsByUser(userId, gameIds),
      getGames(),
      fetchTipsterJoinedAt(userId),
    ]);

    return buildTipsterTips({ storedTips, games, gameIds, userId, joinedAt, now: Date.now() });
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  await ensureUserAuthenticated();

  const repo = serviceRegistry.getService("tipsRepository");
  const tips: AllTipsRow[] = await repo.getAllTips();

  const { getGames } = serviceRegistry.getService("squiggleService");
  const games: AflGame.Type[] = await getGames();
  const tipsters = await fetchAllClerkUsers();

  return buildLeaderboard({ tips, games, tipsters, now: Date.now() });
});

const GetGroupTipsSchema = z.object({
  round: z.number(),
});

export const getGroupTips = createServerFn({ method: "GET" })
  .validator(GetGroupTipsSchema)
  .handler(async ({ data }): Promise<AflGroupTipEntry[]> => {
    await ensureUserAuthenticated();

    const { round } = data;
    const { getGames } = serviceRegistry.getService("squiggleService");
    const roundGames: AflGame.Type[] = await getGames(round);

    const repo = serviceRegistry.getService("tipsRepository");
    const tips = await repo.getTipsByGameIds(roundGames.map((g) => g.id));
    const tipsters = await fetchAllClerkUsers();

    return buildGroupTips({ tips, roundGames, tipsters, now: Date.now() });
  });

export const getPlayerStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<AflPlayerStatsEntry[]> => {
    await ensureUserAuthenticated();

    const repo = serviceRegistry.getService("tipsRepository");
    const tips: AllTipsRow[] = await repo.getAllTips();

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames();
    const tipsters = await fetchAllClerkUsers();

    return buildPlayerStats({ tips, games, tipsters, now: Date.now() });
  },
);

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
  getGroupTips,
  getPlayerStats,
};
