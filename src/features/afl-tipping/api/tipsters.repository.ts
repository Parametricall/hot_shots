import * as z from "zod";
import { getSupabaseServerClient } from "~/lib/supabase";
import type { Tipsters } from "./competition";

const JoinedRowSchema = z.object({ joined_at: z.string() });

const TipsterRowSchema = z.object({
  profile_id: z.string(),
  joined_at: z.string(),
  // PostgREST returns the joined row as an object for a to-one relation.
  profiles: z.object({ display_name: z.string(), avatar_url: z.string().nullable() }),
});

export type JoinResult =
  | { ok: true; joinedAt: number }
  | { ok: false; reason: string; detail?: string };

export type TipstersResult =
  | { ok: true; tipsters: Tipsters }
  | { ok: false; reason: string; detail?: string };

/**
 * Who has joined AFL Tipping, and when (`afl_tipsters`, docs/adr/0006). A Profile becomes a Tipster
 * the first time they open AFL Tipping.
 */
export const tipstersRepository = {
  /**
   * Makes the Profile a Tipster if they aren't one. The upsert sends only `profile_id`, so an
   * existing row keeps its `joined_at`, the date Auto-tips start from (docs/adr/0001).
   */
  async joinAflTipping(profileId: string): Promise<JoinResult> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("afl_tipsters")
      .upsert({ profile_id: profileId }, { onConflict: "profile_id" })
      .select("joined_at")
      .single();
    if (error) return { ok: false, reason: "supabase-error", detail: error.message };
    const parsed = JoinedRowSchema.safeParse(data);
    if (!parsed.success) return { ok: false, reason: "bad-row", detail: parsed.error.message };
    return { ok: true, joinedAt: new Date(parsed.data.joined_at).getTime() };
  },

  async getTipsters(): Promise<TipstersResult> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("afl_tipsters")
      .select("profile_id, joined_at, profiles (display_name, avatar_url)");
    if (error) return { ok: false, reason: "supabase-error", detail: error.message };
    const parsed = z.array(TipsterRowSchema).safeParse(data);
    if (!parsed.success) return { ok: false, reason: "bad-row", detail: parsed.error.message };
    const tipsters: Tipsters = new Map(
      parsed.data.map((row) => [
        row.profile_id,
        {
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
          joinedAt: new Date(row.joined_at).getTime(),
        },
      ]),
    );
    return { ok: true, tipsters };
  },
};
