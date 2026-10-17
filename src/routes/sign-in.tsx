import { createFileRoute, redirect } from "@tanstack/react-router";
import * as z from "zod";
import { SignInPage } from "~/features/auth/pages/sign-in";
import { IS_DEMO } from "~/lib/demo";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({
    redirect_url: z
      .string()
      .optional()
      .transform((value) => (value?.startsWith("/") ? value : undefined)),
  }),
  // The Demo has no sign-in: go straight to AFL Tipping.
  beforeLoad: () => {
    if (IS_DEMO) throw redirect({ to: "/afl-tipping/tips" });
  },
  component: SignInPage,
});
