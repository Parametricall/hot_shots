import { getSupabaseServerClient } from "~/lib/supabase";

export const featureFlagsRepository = {
  async isEnabled(key: string): Promise<boolean> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", key)
      .single();
    if (error) return false;
    return data?.enabled ?? false;
  },

  async setEnabled(key: string, enabled: boolean): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("feature_flags")
      .upsert({ key, enabled, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      throw new Error(error.message || "Failed to update feature flag");
    }
  },
};
