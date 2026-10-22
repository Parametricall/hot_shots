import { createFileRoute, redirect } from "@tanstack/react-router";
import { IS_DEMO } from "~/lib/demo";

// Sign-up is gone: an invited person's first sign-in creates their Profile (docs/adr/0006).
// The route stays so old bookmarks still work.
export const Route = createFileRoute("/sign-up")({
  beforeLoad: () => {
    if (IS_DEMO) throw redirect({ to: "/afl-tipping/tips" });
    throw redirect({ to: "/sign-in" });
  },
});
