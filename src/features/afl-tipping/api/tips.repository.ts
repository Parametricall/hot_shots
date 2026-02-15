import { getSupabaseServerClient } from "~/utils/supabase";
import { AflUserTip } from "~/features/afl-tipping/types";

interface TipRow {
  game_id: number;
  tip: number;
}

export interface AllTipsRow {
  game_id: number;
  user_id: string;
  tip: number;
}

export const tipsRepository = {
  async saveTip(gameId: number, userId: string, teamId: number): Promise<void> {
    const supabaseClient = await getSupabaseServerClient();
    const { error } = await supabaseClient
      .from("afl_tipping")
      .upsert({ game_id: gameId, user_id: userId, tip: teamId }, { onConflict: "game_id,user_id" });
    if (error) {
      throw new Error(error.message || "Failed to submit tip");
    }
  },

  async getTipsByUser(userId: string, gameIds: number[]): Promise<AflUserTip[]> {
    const supabaseClient = await getSupabaseServerClient();
    const { data: tips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, tip")
      .eq("user_id", userId)
      .in("game_id", gameIds);
    if (error) {
      throw new Error(error.message || "Failed to fetch tips");
    }
    return (tips || []).map((row: TipRow) => ({
      gameId: row.game_id,
      tipTeamId: row.tip,
    }));
  },

  async getAllTips(): Promise<AllTipsRow[]> {
    const supabaseClient = await getSupabaseServerClient();
    const { data: allTips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, user_id, tip");
    if (error) {
      throw new Error(error.message || "Failed to fetch all tips");
    }
    return (allTips ?? []) as AllTipsRow[];
  },
};
