import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { getSupabaseAuthClient, getSupabaseServerClient } from "~/lib/supabase";

const DEFAULT_REDIRECT = "/afl-tipping/tips";

/**
 * Where to send someone after sign-in: `value` if it is a path on this site, else the tips page.
 * A `//host` or `/\host` path is read by browsers as another site, so it is refused.
 */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_REDIRECT;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_REDIRECT;
  }
  return value;
}

/**
 * The signed-in Profile's id, or null. `getClaims()` reads the session from the cookies, which
 * refreshes an expired access token through the refresh token and writes the new pair back
 * through the cookie `setAll`, so this one call also keeps the session alive. The token is
 * verified locally against the project's signing key. Parallel calls may refresh the same token
 * at once; the project's refresh-token reuse interval covers that (docs/adr/0006).
 */
export async function getSessionUserId(): Promise<string | null> {
  const supabase = getSupabaseAuthClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return data.claims.sub;
}

export type CurrentUserDto = { id: string; displayName: string; imageUrl: string | null };

/** The signed-in Profile, or null. The Profile is the person on the site, not on one App. */
export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUserDto | null> => {
    const userId = await getSessionUserId();
    if (!userId) return null;
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, displayName: data.display_name, imageUrl: data.avatar_url };
  },
);

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = getSupabaseAuthClient();
  await supabase.auth.signOut({ scope: "local" });
  return { ok: true as const };
});

export type SignInResult = { ok: true } | { ok: false; reason: string; detail?: string };

const EmailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });
const VerifySchema = EmailSchema.extend({
  code: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/),
});

function otpReason(error: { status?: number; message: string; code?: string }): string {
  if (error.message.includes("not-invited")) return "not-invited";
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return "rate-limited";
  if (error.code === "otp_expired") return "code-expired";
  return "failed";
}

/** Emails a one-time code. The Before User Created hook still turns away uninvited addresses. */
export const sendSignInCode = createServerFn({ method: "POST" })
  .validator(EmailSchema)
  .handler(async ({ data }): Promise<SignInResult> => {
    const supabase = getSupabaseAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      console.error("[sendSignInCode] failed", { message: error.message, status: error.status });
      return { ok: false, reason: otpReason(error), detail: error.message };
    }
    return { ok: true };
  });

export const verifySignInCode = createServerFn({ method: "POST" })
  .validator(VerifySchema)
  .handler(async ({ data }): Promise<SignInResult> => {
    const supabase = getSupabaseAuthClient();
    const { error } = await supabase.auth.verifyOtp({
      email: data.email,
      token: data.code,
      type: "email",
    });
    if (error) {
      const reason = otpReason(error);
      return {
        ok: false,
        reason: reason === "failed" ? "code-wrong" : reason,
        detail: error.message,
      };
    }
    return { ok: true };
  });

const DevSignInSchema = z.object({ email: z.string(), password: z.string() });

/** Dev quick-login only. Refuses in production. */
export const devSignInWithPassword = createServerFn({ method: "POST" })
  .validator(DevSignInSchema)
  .handler(async ({ data }): Promise<SignInResult> => {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "not-available" };
    }
    const supabase = getSupabaseAuthClient();
    const { error } = await supabase.auth.signInWithPassword(data);
    if (error) return { ok: false, reason: "failed", detail: error.message };
    return { ok: true };
  });
