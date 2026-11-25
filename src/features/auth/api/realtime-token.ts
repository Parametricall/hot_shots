import { createServerFn } from "@tanstack/react-start";
import { getSupabaseAuthClient } from "~/lib/supabase";

/**
 * What the browser needs to join the private Realtime channel (plan 015, D5). `expiresAt` is
 * epoch milliseconds. `publishableKey` is public by design (it is the `apikey` the Realtime
 * socket sends); the server reads it from `SUPABASE_PUBLISHABLE_KEY`, so the browser needs no
 * extra `VITE_` variable. The refresh token never leaves the server's cookies.
 */
export type RealtimeTokenResult =
  | { ok: true; accessToken: string; expiresAt: number; publishableKey: string }
  | { ok: false; reason: "unauthenticated" | "not-configured" };

/**
 * The signed-in session's access token. `getClaims()` verifies the token and, if it has
 * expired, refreshes it and writes the new pair back to the cookies (as `getSessionUserId`
 * does); `getSession()` then reads the access token from that refreshed session.
 */
export async function readRealtimeToken(): Promise<RealtimeTokenResult> {
  const supabase = getSupabaseAuthClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims.sub) return { ok: false, reason: "unauthenticated" };

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.access_token || !session.expires_at) {
    return { ok: false, reason: "unauthenticated" };
  }

  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!publishableKey) return { ok: false, reason: "not-configured" };

  return {
    ok: true,
    accessToken: session.access_token,
    expiresAt: session.expires_at * 1000,
    publishableKey,
  };
}

export const getRealtimeToken = createServerFn({ method: "GET" }).handler(
  (): Promise<RealtimeTokenResult> => readRealtimeToken(),
);
