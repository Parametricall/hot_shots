import { createServerOnlyFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";

/**
 * The app's only ways into Supabase (docs/adr/0002-supabase-is-server-only.md,
 * docs/adr/0006-supabase-auth-replaces-clerk.md). Both run on the server only.
 *
 * `getSupabaseServerClient` is for data. Every table has Row-Level Security on
 * and no policies, so the publishable (anon) key can read and write nothing.
 * This client uses the secret key, which bypasses RLS, so authorization lives
 * entirely in the server functions that call it: they check the session
 * (`getSessionUserId`) before touching a row.
 *
 * `getSupabaseAuthClient` is for the session. It uses the publishable key and
 * is bound to the request's cookies: the server reads the session from them
 * and sets them itself, `HttpOnly`, so Safari doesn't cap them at 7 days the
 * way it caps cookies written by JavaScript. It never reads a table.
 *
 * `SUPABASE_SECRET_KEY` takes either a `sb_secret_…` key or the legacy
 * `service_role` JWT. It must never have a `VITE_` prefix: Vite inlines every
 * `VITE_*` variable into the browser bundle.
 *
 * `createServerOnlyFn` strips this body from the client build. The router
 * registers the tips repository on both sides, so without it this module, and
 * supabase-js with it, ships to the browser; a client-side call now throws
 * instead of reaching for a key.
 */
export const getSupabaseServerClient = createServerOnlyFn(async () => {
  const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL / VITE_SUPABASE_URL is not set");
  }
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

/**
 * Supabase Auth for this request, with the session kept in cookies the server
 * sets. Call it once per request or server function: it reads the cookies when
 * called. Keep `@supabase/ssr`'s long default `maxAge`: Supabase Auth, not the
 * cookie, decides when a session ends (docs/adr/0006).
 */
export const getSupabaseAuthClient = createServerOnlyFn(() => {
  const supabaseUrl = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL / VITE_SUPABASE_URL is not set");
  }
  if (!publishableKey) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is not set");
  }
  return createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => Object.entries(getCookies()).map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value, options } of cookies) {
          setCookie(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        }
      },
    },
  });
});
