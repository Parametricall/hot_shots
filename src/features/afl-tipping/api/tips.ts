import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { auth } from "@clerk/tanstack-react-start/server";
import { AflUserTip, AflGame } from "~/features/afl-tipping/types";
import serviceRegistry from "~/service-registry";
import { gameRules } from "./game-rules";
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
    const squiggleService = serviceRegistry.getService("squiggleService");
    // Always use getGames and find by id
    const games: AflGame[] = await squiggleService.getGames();
    const game = games.find((g) => g.id === gameId);
    // Use 'date' as the start time property (Squiggle API)
    const startTime = game?.date as string | undefined;
    if (!game || !startTime) {
      throw new Error("Game not found in Squiggle API");
    }
    // Use gameRules abstraction
    if (!gameRules.canSubmitTip({ gameStart: new Date(startTime) })) {
      throw new Error("Cannot submit tip after the game has started");
    }
    // Save tip directly to Supabase
    const supabaseClient = await getSupabaseServerClient();

    const { data: data2, error } = await supabaseClient
      .from("afl_tipping")
      .select()
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .single();

    if (data2) {
      // Update existing row
      const { data: dd, error: ee } = await supabaseClient
        .from("afl_tipping")
        .update({ tip: teamId })
        .eq("game_id", gameId)
        .eq("user_id", userId);
    } else {
      // Insert new row
      const { data: r, error: e } = await supabaseClient
        .from("afl_tipping")
        .insert({ game_id: gameId, user_id: userId, tip: teamId });
    }
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
    console.log("env", process.env.CLERK_SECRET_KEY);

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
