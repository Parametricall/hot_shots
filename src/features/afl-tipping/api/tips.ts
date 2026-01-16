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
  team_id: number;
}

export const submitTip = createServerFn({ method: "POST" })
  .inputValidator(SubmitTipSchema)
  .handler(async ({ data }) => {
    console.log("data", data);
    const { gameId, teamId } = data;
    const { userId } = await auth();
    console.log("userId", userId);
    if (!userId) {
      throw new Error("User not authenticated");
    }
    console.log("serviceRegistry", serviceRegistry);
    // Use service registry to get services
    const squiggleService = serviceRegistry.getService("squiggleService");
    console.log("squiggleService", squiggleService);
    // Always use getGames and find by id
    const games: AflGame[] = await squiggleService.getGames();
    console.log("games", games);
    const game = games.find((g) => g.id === gameId);
    console.log("game", game);
    // Use 'date' as the start time property (Squiggle API)
    const startTime = game?.date as string | undefined;
    if (!game || !startTime) {
      throw new Error("Game not found in Squiggle API");
    }
    console.log("startTime", startTime);
    // Use gameRules abstraction
    if (!gameRules.canSubmitTip({ gameStart: new Date(startTime) })) {
      throw new Error("Cannot submit tip after the game has started");
    }
    console.log("Submitting tip for user:", userId);
    // Save tip directly to Supabase
    const supabaseClient = getSupabaseServerClient();

    console.log("Checking for existing tip for user:", userId);
    const { data: data2, error } = await supabaseClient
      .from("afl_tipping")
      .select()
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .single();

    console.log("Existing tip data:", data2, error);

    if (data2) {
      console.log("Updating existing tip for user:", userId);
      // Update existing row
      await supabaseClient
        .from("afl_tipping")
        .update({ tip: teamId })
        .eq("game_id", gameId)
        .eq("user_id", userId);
    } else {
      console.log("Inserting new tip for user:", userId);
      // Insert new row
      await supabaseClient
        .from("afl_tipping")
        .insert({ game_id: gameId, user_id: userId, tip: teamId });
    }

    // const { error } = await supabaseClient.from("afl_tipping").upsert(
    //   [
    //     {
    //       user_id: userId,
    //       game_id: gameId,
    //       team_id: teamId,
    //     },
    //   ],
    //   { onConflict: "user_id,game_id" },
    // );
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
    const supabaseClient = getSupabaseServerClient();
    const { data: tips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, team_id")
      .eq("user_id", userId)
      .in("game_id", gameIds);
    if (error) {
      throw new Error(error.message || "Failed to fetch tips");
    }
    // Map to AflUserTip[]
    const result: AflUserTip[] = (tips || []).map((row: TipRow) => ({
      gameId: row.game_id,
      tipTeamId: row.team_id,
    }));
    return result;
  });

export const service = {
  submitTip,
  getTips,
};
