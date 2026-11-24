import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { StatsPage } from "~/features/afl-tipping/pages/stats";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { STATS_VIEWS } from "~/features/afl-tipping/components/stats-view";

export const Route = createFileRoute("/_authenticated/afl-tipping/$season/stats")({
  // `view` is the segment shown: Tipster stats (the default) or the AFL Ladder. It is in the URL
  // so a reload, or a shared link, lands on the same one.
  validateSearch: z.object({
    round: z.number().int().nonnegative().optional(),
    view: z.enum(STATS_VIEWS).optional().catch(undefined),
  }),
  component: StatsPage,
  loader: async ({ params: { season }, context: { queryClient } }) => {
    void queryClient.ensureQueryData(aflQueries.playerStats(season));
    void queryClient.prefetchQuery(aflQueries.standings(season));
  },
});
