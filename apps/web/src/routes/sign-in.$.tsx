import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { SignInPage } from "~/features/auth/pages/sign-in";

export const Route = createFileRoute("/sign-in/$")({
  validateSearch: z.object({
    redirect_url: z
      .string()
      .optional()
      .transform((value) => (value?.startsWith("/") ? value : undefined)),
  }),
  component: SignInPage,
});
