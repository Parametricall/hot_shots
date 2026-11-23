import { createFileRoute } from "@tanstack/react-router";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";

// The Season summary replaces this in the next step.
export const Route = createFileRoute("/_authenticated/afl-tipping/$season/")({
  component: Leaderboard,
});
