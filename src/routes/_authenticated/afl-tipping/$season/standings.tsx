import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// The AFL Ladder moved into the Stats page as one of its two views. Links to the old tab, from
// before the Leaderboard had a tab of its own, still land on it.
export const Route = createFileRoute("/_authenticated/afl-tipping/$season/standings")({
  validateSearch: z.object({ round: z.number().int().nonnegative().optional() }),
  beforeLoad: ({ params: { season }, search }) => {
    throw redirect({
      to: "/afl-tipping/$season/stats",
      params: { season },
      search: { round: search.round, view: "ladder" },
      replace: true,
    });
  },
});
