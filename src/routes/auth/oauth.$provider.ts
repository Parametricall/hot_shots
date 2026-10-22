import { createFileRoute } from "@tanstack/react-router";
import { safeRedirectPath } from "~/features/auth/api/session";
import { getSupabaseAuthClient } from "~/lib/supabase";

const PROVIDERS = ["google"] as const;
type Provider = (typeof PROVIDERS)[number];

/**
 * Starts an OAuth sign-in: asks Supabase Auth for the provider's URL (the PKCE verifier lands in
 * a cookie) and sends the browser there. The page links here with a plain `<a>`, so the whole
 * page navigates (docs/adr/0006).
 */
export const Route = createFileRoute("/auth/oauth/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const provider = params.provider as Provider;
        if (!PROVIDERS.includes(provider)) return new Response("Not found", { status: 404 });

        const url = new URL(request.url);
        const next = safeRedirectPath(url.searchParams.get("next"));
        const supabase = getSupabaseAuthClient();
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            skipBrowserRedirect: true,
          },
        });
        if (error || !data.url) {
          console.error("[oauth] could not start", { provider, message: error?.message });
          return Response.redirect(`${url.origin}/sign-in?error=failed`, 302);
        }
        return Response.redirect(data.url, 302);
      },
    },
  },
});
