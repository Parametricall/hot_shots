import { createFileRoute } from "@tanstack/react-router";
import { safeRedirectPath } from "~/features/auth/api/session";
import { getSupabaseAuthClient, getSupabaseServerClient } from "~/lib/supabase";

/**
 * Where Supabase Auth sends the browser back after the provider. Exchanges the code for a
 * session (set in cookies) and fills in a Profile's missing photo. Migrated Profiles start
 * without one, since Clerk's image URLs die with the Clerk app (plans/013).
 */
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const next = safeRedirectPath(url.searchParams.get("next"));
        const toSignIn = (reason: string) =>
          Response.redirect(`${url.origin}/sign-in?error=${reason}`, 302);

        const providerError = url.searchParams.get("error_description");
        if (url.searchParams.get("error") || providerError) {
          console.error("[auth callback] provider error", { detail: providerError });
          return toSignIn(providerError?.includes("not-invited") ? "not-invited" : "failed");
        }

        const code = url.searchParams.get("code");
        if (!code) return toSignIn("failed");

        const supabase = getSupabaseAuthClient();
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.user) {
          console.error("[auth callback] exchange failed", { message: error?.message });
          return toSignIn(error?.message.includes("not-invited") ? "not-invited" : "failed");
        }

        const metadata = data.user.user_metadata as Record<string, unknown>;
        const photo = metadata.avatar_url ?? metadata.picture;
        if (typeof photo === "string") {
          const db = await getSupabaseServerClient();
          await db
            .from("profiles")
            .update({ avatar_url: photo })
            .eq("id", data.user.id)
            .is("avatar_url", null);
        }
        return Response.redirect(`${url.origin}${next}`, 302);
      },
    },
  },
});
