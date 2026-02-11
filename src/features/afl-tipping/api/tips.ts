import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import {
  AflUserTip,
  AflGame,
  AflLeaderboardEntry,
} from "~/features/afl-tipping/types";
import { createClerkClient } from "@clerk/backend";
import serviceRegistry from "~/service-registry";
import { GameRules } from "./game-rules";
import { getSupabaseServerClient } from "~/utils/supabase";

const SubmitTipSchema = z.object({
  gameId: z.number(), // Squiggle game id
  teamId: z.number(), // Squiggle team id
});

const GetTipsSchema = z.object({
  gameIds: z.array(z.number()),
});

interface TipRow {
  game_id: number;
  tip: number;
}

async function ensureUserAuthenticated(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return userId;
}

export const submitTip = createServerFn({ method: "POST" })
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId } = data;
    const userId = await ensureUserAuthenticated();

    // Use service registry to get services
    const { getGames } = serviceRegistry.getService("squiggleService");
    // Always use getGames and find by id
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
    // Save tip directly to Supabase
    const supabaseClient = await getSupabaseServerClient();

    const { error } = await supabaseClient
      .from("afl_tipping")
      .upsert(
        { game_id: gameId, user_id: userId, tip: teamId },
        { onConflict: "game_id,user_id" },
      );
    if (error) {
      throw new Error(error.message || "Failed to submit tip");
    }
    return { success: true };
  });

export const getTips = createServerFn({ method: "GET" })
  .inputValidator(GetTipsSchema)
  .handler(async ({ data }) => {
    const { gameIds } = data;
    const userId = await ensureUserAuthenticated();

    const supabaseClient = await getSupabaseServerClient();
    const { data: tips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, tip")
      .eq("user_id", userId)
      .in("game_id", gameIds);
    if (error) {
      throw new Error(error.message || "Failed to fetch tips");
    }
    // Map to AflUserTip[]
    const result: AflUserTip[] = (tips || []).map((row: TipRow) => ({
      gameId: row.game_id,
      tipTeamId: row.tip,
    }));
    return result;
  });

interface AllTipsRow {
  game_id: number;
  user_id: string;
  tip: number;
}

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async () => {
    await ensureUserAuthenticated();

    const supabaseClient = await getSupabaseServerClient();
    const { data: allTips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, user_id, tip");
    if (error) {
      throw new Error(error.message || "Failed to fetch all tips");
    }

    const { getGames } = serviceRegistry.getService("squiggleService");
    const games: AflGame[] = await getGames();
    const completedGameWinners = new Map<number, number | null>();
    for (const game of games) {
      if (AflGame.isComplete(game)) {
        completedGameWinners.set(game.id, game.winnerTeamId);
      }
    }

    const userStats = new Map<string, { correct: number; total: number }>();
    for (const tip of (allTips ?? []) as AllTipsRow[]) {
      const winner = completedGameWinners.get(tip.game_id);
      if (winner === undefined) continue;

      const stats = userStats.get(tip.user_id) ?? { correct: 0, total: 0 };
      stats.total += 1;
      if (tip.tip === winner) {
        stats.correct += 1;
      }
      userStats.set(tip.user_id, stats);
    }

    const userIds = Array.from(userStats.keys());
    if (userIds.length === 0) return [];

    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const BATCH_SIZE = 100;
    const userMap = new Map<
      string,
      { displayName: string; avatarUrl: string | null }
    >();
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      const { data: users } = await clerkClient.users.getUserList({
        userId: batch,
        limit: BATCH_SIZE,
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
    }

    const leaderboard: AflLeaderboardEntry[] = userIds.map((userId) => {
      const stats = userStats.get(userId)!;
      const userInfo = userMap.get(userId) ?? {
        displayName: "Unknown User",
        avatarUrl: null,
      };
      return {
        userId,
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        correctTips: stats.correct,
        totalTips: stats.total,
        accuracy:
          stats.total > 0
            ? Math.round((stats.correct / stats.total) * 1000) / 10
            : 0,
      };
    });

    leaderboard.sort((a, b) => {
      if (b.correctTips !== a.correctTips) return b.correctTips - a.correctTips;
      return b.accuracy - a.accuracy;
    });

    return leaderboard;
  },
);

export const service = {
  submitTip,
  getTips,
  getLeaderboard,
};
