import { createFileRoute } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { SeasonSummaryPage } from "~/features/afl-tipping/pages/season-summary";

export const Route = createFileRoute("/_authenticated/afl-tipping/$season/")({
  loader: ({ params: { season }, context: { queryClient } }) => {
    void queryClient.prefetchQuery(aflQueries.allGames(season));
    void queryClient.prefetchQuery(aflQueries.leaderboard(season));
  },
  component: SeasonSummaryPage,
});
