import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getSessionUserId } from "~/features/auth/api/session";
import type {
  AflGroupTipEntry,
  AflPlayerStatsEntry,
  AflUserTip,
} from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import serviceRegistry from "~/app/service-registry";
import type { AllTipsRow } from "./tips.repository";
import {
  TIP_REJECTION_MESSAGES,
  buildGroupTips,
  buildLeaderboard,
  buildPlayerStats,
  buildTipsterTips,
  judgeTip,
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

/**
 * Who is calling, as a Tipster. Opening any AFL Tipping page joins the signed-in Profile to AFL
 * Tipping the first time (docs/adr/0006), so every handler goes through here.
 */
async function ensureTipster(): Promise<{ userId: string; joinedAt: number }> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  const joined = await serviceRegistry.getService("tipstersRepository").joinAflTipping(userId);
  if (!joined.ok) {
    throw new Error(`Failed to join AFL Tipping: ${joined.reason}`, { cause: joined.detail });
  }
  return { userId, joinedAt: joined.joinedAt };
}

async function fetchTipsters(): Promise<Tipsters> {
  const result = await serviceRegistry.getService("tipstersRepository").getTipsters();
  if (!result.ok) {
    throw new Error(`Failed to load Tipsters: ${result.reason}`, { cause: result.detail });
  }
  return result.tipsters;
}

export const submitTip = createServerFn({ method: "POST" })
  .validator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId, margin } = data;
    try {
      const { userId } = await ensureTipster();

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
    const { userId, joinedAt } = await ensureTipster();

    const { getTipsByUser } = serviceRegistry.getService("tipsRepository");
    const { getGames } = serviceRegistry.getService("squiggleService");

    const [storedTips, games] = await Promise.all([getTipsByUser(userId, gameIds), getGames()]);

    return buildTipsterTips({ storedTips, games, gameIds, userId, joinedAt, now: Date.now() });
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  await ensureTipster();

  const repo = serviceRegistry.getService("tipsRepository");
  const tips: AllTipsRow[] = await repo.getAllTips();

  const { getGames } = serviceRegistry.getService("squiggleService");
  const games: AflGame.Type[] = await getGames();
  const tipsters = await fetchTipsters();

  return buildLeaderboard({ tips, games, tipsters, now: Date.now() });
});

const GetGroupTipsSchema = z.object({
  round: z.number(),
});

export const getGroupTips = createServerFn({ method: "GET" })
  .validator(GetGroupTipsSchema)
  .handler(async ({ data }): Promise<AflGroupTipEntry[]> => {
    await ensureTipster();

    const { round } = data;
    const { getGames } = serviceRegistry.getService("squiggleService");
    const roundGames: AflGame.Type[] = await getGames(round);

    const repo = serviceRegistry.getService("tipsRepository");
    const tips = await repo.getTipsByGameIds(roundGames.map((g) => g.id));
    const tipsters = await fetchTipsters();

    return buildGroupTips({ tips, roundGames, tipsters, now: Date.now() });
  });

export const getPlayerStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<AflPlayerStatsEntry[]> => {
    await ensureTipster();

    const repo = serviceRegistry.getService("tipsRepository");
    const tips: AllTipsRow[] = await repo.getAllTips();

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames();
    const tipsters = await fetchTipsters();

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
