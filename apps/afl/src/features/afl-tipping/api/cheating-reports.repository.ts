import { getSupabaseServerClient } from "~/lib/supabase";

export const cheatingReportsRepository = {
  async report(reportedUserId: string, reporterUserId: string): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("cheating_reports")
      .insert({ reported_user_id: reportedUserId, reporter_user_id: reporterUserId });
    if (error) {
      throw new Error(error.message || "Failed to submit report");
    }
  },

  async getReportCount(userId: string): Promise<number> {
    const supabase = await getSupabaseServerClient();
    const { count, error } = await supabase
      .from("cheating_reports")
      .select("*", { count: "exact", head: true })
      .eq("reported_user_id", userId);
    if (error) {
      throw new Error(error.message || "Failed to check reports");
    }
    return count ?? 0;
  },

  async dismissReports(userId: string): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("cheating_reports")
      .delete()
      .eq("reported_user_id", userId);
    if (error) {
      throw new Error(error.message || "Failed to dismiss reports");
    }
  },
};
