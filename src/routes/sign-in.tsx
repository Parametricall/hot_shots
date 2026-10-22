import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { SignInPage } from "~/features/auth/pages/sign-in";
import { safeRedirectPath } from "~/features/auth/api/session";
import { IS_DEMO } from "~/lib/demo";

/** The host Google names on its consent screen, so the page can explain it. */
const getSupabaseHost = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
});

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    redirect_url: z
      .string()
      .optional()
      .transform((value) => (value === undefined ? undefined : safeRedirectPath(value))),
    error: z.string().optional(),
  }),
  // The Demo has no sign-in: go straight to AFL Tipping.
  beforeLoad: () => {
    if (IS_DEMO) throw redirect({ to: "/afl-tipping/tips" });
  },
  loader: async () => ({ supabaseHost: await getSupabaseHost() }),
  component: SignInPage,
});
