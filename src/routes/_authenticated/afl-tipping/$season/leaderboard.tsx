import { createFileRoute } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { LeaderboardPage } from "~/features/afl-tipping/pages/leaderboard";

export const Route = createFileRoute("/_authenticated/afl-tipping/$season/leaderboard")({
  component: LeaderboardPage,
  loader: ({ params: { season }, context: { queryClient } }) => {
    void queryClient.prefetchQuery(aflQueries.leaderboard(season));
    void queryClient.prefetchQuery(aflQueries.playerStats(season));
    void queryClient.prefetchQuery(aflQueries.allGames(season));
  },
});
