import { createServerOnlyFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

/**
 * The app's only way into Supabase (docs/adr/0002-supabase-is-server-only.md).
 *
 * Every table has Row-Level Security on and no policies, so the publishable
 * (anon) key can read and write nothing. This client uses the secret key, which
 * bypasses RLS, so authorization lives entirely in the server functions that
 * call it: they check the Clerk session before touching a row.
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
