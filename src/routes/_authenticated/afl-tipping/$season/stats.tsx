import { createFileRoute } from "@tanstack/react-router";
import { StatsPage } from "~/features/afl-tipping/pages/stats";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/_authenticated/afl-tipping/$season/stats")({
  component: StatsPage,
  loader: async ({ params: { season }, context: { queryClient } }) => {
    void queryClient.ensureQueryData(aflQueries.leaderboard(season));
    void queryClient.ensureQueryData(aflQueries.playerStats(season));
  },
});
