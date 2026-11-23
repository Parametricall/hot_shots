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
import { FIRST_SEASON } from "~/features/afl-tipping/constants";
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

const SeasonSchema = z.number().int().min(FIRST_SEASON);

const SubmitTipSchema = z.object({
  season: SeasonSchema,
  gameId: z.number(), // Squiggle game id
  teamId: z.number(), // Squiggle team id
  margin: z.number().min(0).max(200).optional(),
});

const GetTipsSchema = z.object({
  season: SeasonSchema,
  gameIds: z.array(z.number()),
});

/**
 * Who is calling, as a Tipster, and when they entered `season`'s Competition (null if they
 * haven't). Opening any AFL Tipping page joins the signed-in Profile to AFL Tipping the first time
 * (docs/adr/0006), and opening it while `season` is the Current Season, and not over, enters them
 * in that Season's Competition (docs/adr/0007). Viewing a past Season enters nothing. Every
 * handler goes through here.
 */
async function ensureTipster(
  season: number,
): Promise<{ userId: string; enteredAt: number | null }> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  const joined = await serviceRegistry.getService("tipstersRepository").joinAflTipping(userId);
  if (!joined.ok) {
    throw new Error(`Failed to join AFL Tipping: ${joined.reason}`, { cause: joined.detail });
  }

  const { current, seasons } = await serviceRegistry.getService("squiggleService").getSeasons();
  if (!seasons.includes(season)) {
    throw new Error(`Unknown Season: ${season}`);
  }

  const entries = serviceRegistry.getService("competitionEntriesRepository");
  if (season === current.season && current.status !== "over") {
    const entered = await entries.enter(userId, season);
    if (!entered.ok) {
      throw new Error(`Failed to enter the ${season} Competition: ${entered.reason}`, {
        cause: entered.detail,
      });
    }
    return { userId, enteredAt: entered.enteredAt };
  }

  const entry = await entries.getEntry(userId, season);
  if (!entry.ok) {
    throw new Error(`Failed to load the ${season} entry: ${entry.reason}`, { cause: entry.detail });
  }
  return { userId, enteredAt: entry.enteredAt };
}

async function fetchEntrants(season: number): Promise<Tipsters> {
  const result = await serviceRegistry
    .getService("competitionEntriesRepository")
    .getEntrants(season);
  if (!result.ok) {
    throw new Error(`Failed to load the ${season} Tipsters: ${result.reason}`, {
      cause: result.detail,
    });
  }
  return result.tipsters;
}

export const submitTip = createServerFn({ method: "POST" })
  .validator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { season, gameId, teamId, margin } = data;
    try {
      const { userId } = await ensureTipster(season);

      const { getGames, getModelTips } = serviceRegistry.getService("squiggleService");
      const games: AflGame.Type[] = await getGames(season);

      const game = games.find((g) => g.id === gameId);
      const modelTips = game ? await getModelTips(season, game.round) : [];
      const modelTip = modelTips.find((t) => t.gameId === gameId);

      const verdict = judgeTip({ game, teamId, modelTip, now: Date.now() });
      if (!verdict.ok) {
        console.warn("[submitTip] tip rejected", { gameId, reason: verdict.reason });
        throw new Error(TIP_REJECTION_MESSAGES[verdict.reason]);
      }

      const repo = serviceRegistry.getService("tipsRepository");
      await repo.saveTip(season, gameId, userId, teamId, margin, verdict.isUnderdog);
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
    const { season, gameIds } = data;
    const { userId, enteredAt } = await ensureTipster(season);

    const { getTipsByUser } = serviceRegistry.getService("tipsRepository");
    const { getGames } = serviceRegistry.getService("squiggleService");

    const [storedTips, games] = await Promise.all([
      getTipsByUser(userId, gameIds),
      getGames(season),
    ]);

    return buildTipsterTips({
      storedTips,
      games,
      gameIds,
      userId,
      // A Tipster who never entered this Season gets no Auto-tips.
      joinedAt: enteredAt ?? Number.POSITIVE_INFINITY,
      now: Date.now(),
    });
  });

const SeasonOnlySchema = z.object({
  season: SeasonSchema,
});

export const getLeaderboard = createServerFn({ method: "GET" })
  .validator(SeasonOnlySchema)
  .handler(async ({ data }) => {
    await ensureTipster(data.season);

    const repo = serviceRegistry.getService("tipsRepository");
    const tips: AllTipsRow[] = await repo.getAllTips(data.season);

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames(data.season);
    const tipsters = await fetchEntrants(data.season);

    return buildLeaderboard({ tips, games, tipsters, now: Date.now() });
  });

const GetGroupTipsSchema = z.object({
  season: SeasonSchema,
  round: z.number(),
});

export const getGroupTips = createServerFn({ method: "GET" })
  .validator(GetGroupTipsSchema)
  .handler(async ({ data }): Promise<AflGroupTipEntry[]> => {
    await ensureTipster(data.season);

    const { season, round } = data;
    const { getGames } = serviceRegistry.getService("squiggleService");
    const roundGames: AflGame.Type[] = await getGames(season, round);

    const repo = serviceRegistry.getService("tipsRepository");
    const tips = await repo.getTipsByGameIds(roundGames.map((g) => g.id));
    const tipsters = await fetchEntrants(data.season);

    return buildGroupTips({ tips, roundGames, tipsters, now: Date.now() });
  });

export const getPlayerStats = createServerFn({ method: "GET" })
  .validator(SeasonOnlySchema)
  .handler(async ({ data }): Promise<AflPlayerStatsEntry[]> => {
    await ensureTipster(data.season);

    const repo = serviceRegistry.getService("tipsRepository");
    const tips: AllTipsRow[] = await repo.getAllTips(data.season);

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame.Type[] = await getGames(data.season);
    const tipsters = await fetchEntrants(data.season);

    return buildPlayerStats({ tips, games, tipsters, now: Date.now() });
  });

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
  getGroupTips,
  getPlayerStats,
};
