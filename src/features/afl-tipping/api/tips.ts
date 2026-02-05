import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import { AflUserTip, AflGame } from "~/features/afl-tipping/types";
import serviceRegistry from "~/service-registry";
import { GameRules } from "./game-rules";
import { getSupabaseServerClient } from "~/utils/supabase";

const SubmitTipSchema = z.object({
  gameId: z.number(), // Squiggle game id
  teamId: z.number(), // Squiggle team id
});

interface TipRow {
  game_id: number;
  tip: number;
}

export const submitTip = createServerFn({ method: "POST" })
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    const { gameId, teamId } = data;
    const { userId } = await auth();
    if (!userId) {
      throw new Error("User not authenticated");
    }
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

const GetTipsSchema = z.object({
  gameIds: z.array(z.number()),
});

export const getTips = createServerFn({ method: "GET" })
  .inputValidator(GetTipsSchema)
  .handler(async ({ data }) => {
    const { gameIds } = data;
    const { userId } = await auth();
    if (!userId) {
      throw new Error("User not authenticated");
    }
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

export const service = {
  submitTip,
  getTips,
};
