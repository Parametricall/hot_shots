import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/afl-tipping/")({
  beforeLoad: () => {
    throw redirect({ to: "/afl-tipping/tips" });
  },
});
