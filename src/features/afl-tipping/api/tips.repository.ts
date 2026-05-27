import { getSupabaseServerClient } from "~/lib/supabase";
import { AflUserTip } from "~/features/afl-tipping/types";

interface TipRow {
  game_id: number;
  tip: number;
  margin: number | null;
  is_underdog: boolean | null;
}

export interface AllTipsRow {
  game_id: number;
  user_id: string;
  tip: number;
  margin: number | null;
  is_underdog: boolean | null;
  created_at: string;
}

export const tipsRepository = {
  async saveTip(
    gameId: number,
    userId: string,
    teamId: number,
    margin?: number,
    isUnderdog?: boolean,
  ): Promise<void> {
    console.log("[saveTip] start", {
      gameId,
      userId,
      teamId,
      margin,
      isUnderdog,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      hasKey: Boolean(
        import.meta.env.VITE_SUPABASE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
      ),
    });
    const supabaseClient = await getSupabaseServerClient();
    try {
      const { error } = await supabaseClient.from("afl_tipping").upsert(
        {
          game_id: gameId,
          user_id: userId,
          tip: teamId,
          margin: margin ?? null,
          is_underdog: isUnderdog ?? null,
        },
        { onConflict: "game_id,user_id" },
      );
      if (error) {
        console.error("[saveTip] supabase returned error", error);
        throw new Error(error.message || "Failed to submit tip");
      }
      console.log("[saveTip] success", { gameId, userId });
    } catch (err) {
      console.error("[saveTip] threw", {
        message: err instanceof Error ? err.message : String(err),
        cause: err instanceof Error ? (err.cause as unknown) : undefined,
      });
      throw err;
    }
  },

  async getTipsByUser(userId: string, gameIds: number[]): Promise<AflUserTip[]> {
    const supabaseClient = await getSupabaseServerClient();
    const { data: tips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, tip, margin, is_underdog")
      .eq("user_id", userId)
      .in("game_id", gameIds);
    if (error) {
      throw new Error(error.message || "Failed to fetch tips");
    }
    return (tips || []).map((row: TipRow) => ({
      gameId: row.game_id,
      tipTeamId: row.tip,
      margin: row.margin ?? undefined,
      isUnderdog: row.is_underdog ?? undefined,
    }));
  },

  async getTipsByGameIds(gameIds: number[]): Promise<AllTipsRow[]> {
    const supabaseClient = await getSupabaseServerClient();
    const { data: tips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, user_id, tip, margin, is_underdog, created_at")
      .in("game_id", gameIds)
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(error.message || "Failed to fetch tips by game IDs");
    }
    return (tips ?? []) as AllTipsRow[];
  },

  async getAllTips(): Promise<AllTipsRow[]> {
    const supabaseClient = await getSupabaseServerClient();
    const { data: allTips, error } = await supabaseClient
      .from("afl_tipping")
      .select("game_id, user_id, tip, margin, is_underdog");
    if (error) {
      throw new Error(error.message || "Failed to fetch all tips");
    }
    return (allTips ?? []) as AllTipsRow[];
  },
};
