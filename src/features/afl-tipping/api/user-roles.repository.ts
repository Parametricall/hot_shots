import { getSupabaseServerClient } from "~/lib/supabase";
import { ensureAuthenticated } from "~/lib/auth";

export const userRolesRepository = {
  async getRolesForUser(userId: string): Promise<string[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw new Error(error.message || "Failed to fetch user roles");
    return data.map((r) => r.role);
  },

  async hasRole(userId: string, role: string): Promise<boolean> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", role)
      .maybeSingle();
    if (error) return false;
    return data !== null;
  },

  async getAllUserRoles(): Promise<{ userId: string; roles: string[] }[]> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("user_roles").select("user_id, role");
    if (error) throw new Error(error.message || "Failed to fetch user roles");

    const rolesByUser = new Map<string, string[]>();
    for (const row of data) {
      if (!rolesByUser.has(row.user_id)) {
        rolesByUser.set(row.user_id, []);
      }
      rolesByUser.get(row.user_id)!.push(row.role);
    }

    return Array.from(rolesByUser.entries()).map(([userId, roles]) => ({ userId, roles }));
  },

  async grantRole(userId: string, role: string): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message || "Failed to grant role");
  },

  async revokeRole(userId: string, role: string): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) throw new Error(error.message || "Failed to revoke role");
  },
};

export async function ensureUserHasRole(role: string): Promise<string> {
  const userId = await ensureAuthenticated();
  const hasRole = await userRolesRepository.hasRole(userId, role);
  if (!hasRole) {
    throw new Error("Unauthorized");
  }
  return userId;
}
