import * as z from "zod";
import { getSupabaseServerClient } from "~/lib/supabase";
import type { Tipsters } from "./competition";
import type { TipstersResult } from "./tipsters.repository";

const EnteredRowSchema = z.object({ entered_at: z.string() });

const EntrantRowSchema = z.object({
  profile_id: z.string(),
  entered_at: z.string(),
  // PostgREST returns the joined row as an object for a to-one relation.
  afl_tipsters: z.object({
    profiles: z.object({ display_name: z.string(), avatar_url: z.string().nullable() }),
  }),
});

export type EnterResult =
  | { ok: true; enteredAt: number }
  | { ok: false; reason: string; detail?: string };

export type EntryResult =
  | { ok: true; enteredAt: number | null }
  | { ok: false; reason: string; detail?: string };

/**
 * Who entered each Season's Competition, and when (`afl_competition_entries`, docs/adr/0007). A
 * Tipster enters a Season the first time they open AFL Tipping while it is the Current Season.
 */
export const competitionEntriesRepository = {
  /**
   * Enters the Tipster in the Season's Competition if they aren't in it. The upsert sends only the
   * keys, so an existing row keeps its `entered_at`, the moment Auto-tips start from.
   */
  async enter(profileId: string, season: number): Promise<EnterResult> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("afl_competition_entries")
      .upsert({ profile_id: profileId, season }, { onConflict: "profile_id,season" })
      .select("entered_at")
      .single();
    if (error) return { ok: false, reason: "supabase-error", detail: error.message };
    const parsed = EnteredRowSchema.safeParse(data);
    if (!parsed.success) return { ok: false, reason: "bad-row", detail: parsed.error.message };
    return { ok: true, enteredAt: new Date(parsed.data.entered_at).getTime() };
  },

  /** When the Tipster entered the Season, or null if they haven't. */
  async getEntry(profileId: string, season: number): Promise<EntryResult> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("afl_competition_entries")
      .select("entered_at")
      .eq("profile_id", profileId)
      .eq("season", season)
      .maybeSingle();
    if (error) return { ok: false, reason: "supabase-error", detail: error.message };
    if (data === null) return { ok: true, enteredAt: null };
    const parsed = EnteredRowSchema.safeParse(data);
    if (!parsed.success) return { ok: false, reason: "bad-row", detail: parsed.error.message };
    return { ok: true, enteredAt: new Date(parsed.data.entered_at).getTime() };
  },

  /** Everyone in the Season's Competition, with `joinedAt` set to when they entered it. */
  async getEntrants(season: number): Promise<TipstersResult> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("afl_competition_entries")
      .select("profile_id, entered_at, afl_tipsters (profiles (display_name, avatar_url))")
      .eq("season", season);
    if (error) return { ok: false, reason: "supabase-error", detail: error.message };
    const parsed = z.array(EntrantRowSchema).safeParse(data);
    if (!parsed.success) return { ok: false, reason: "bad-row", detail: parsed.error.message };
    const tipsters: Tipsters = new Map(
      parsed.data.map((row) => [
        row.profile_id,
        {
          displayName: row.afl_tipsters.profiles.display_name,
          avatarUrl: row.afl_tipsters.profiles.avatar_url,
          joinedAt: new Date(row.entered_at).getTime(),
        },
      ]),
    );
    return { ok: true, tipsters };
  },
};
