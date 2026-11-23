import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseServerClient } from "~/lib/supabase";

type DatabaseCheck = { ok: true } | { ok: false; reason: string; detail?: string };

/**
 * Whether the site can reach its database, for uptime checks. It's public on purpose: a
 * scheduled GitHub Action (`.github/workflows/keep-supabase-awake.yml`) calls it so the
 * free Supabase project, which pauses after a week without activity, stays awake through
 * the AFL off-season.
 *
 * A HEAD count on `profiles` runs a real query on Postgres, which is what counts as
 * activity, but returns no rows. The secret-key client is the only one that can run it
 * (docs/adr/0002). On failure the response gives only the `reason` code. The `detail`
 * goes to the server log, so the endpoint doesn't leak error messages to the public.
 */
async function checkDatabase(): Promise<DatabaseCheck> {
  try {
    const supabase = await getSupabaseServerClient();
    const { error, status } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    // A HEAD response has no body, so `error.message` is often empty; the status says more.
    if (error) {
      return { ok: false, reason: "query-failed", detail: error.message || `HTTP ${status}` };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "no-client",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const check = await checkDatabase();
        // A cached 200 would keep the check passing without ever reaching the database.
        const headers = { "Cache-Control": "no-store" };
        if (check.ok) return Response.json({ ok: true }, { headers });
        console.error(`[health] database check failed: ${check.reason}`, check.detail);
        return Response.json({ ok: false, reason: check.reason }, { status: 503, headers });
      },
    },
  },
});
