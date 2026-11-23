import { createFileRoute } from "@tanstack/react-router";
import { StatsPage } from "~/features/afl-tipping/pages/stats";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/_authenticated/afl-tipping/stats")({
  component: StatsPage,
  loader: async ({ context: { queryClient } }) => {
    const { current } = await queryClient.ensureQueryData(aflQueries.seasons());
    void queryClient.ensureQueryData(aflQueries.leaderboard(current.season));
    void queryClient.ensureQueryData(aflQueries.playerStats(current.season));
  },
});
