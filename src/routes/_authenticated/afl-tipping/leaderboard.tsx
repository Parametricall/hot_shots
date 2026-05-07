import { createFileRoute } from "@tanstack/react-router";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/_authenticated/afl-tipping/leaderboard")({
  component: Leaderboard,
  loader: async ({ context: { queryClient } }) => {
    void queryClient.ensureQueryData(aflQueries.leaderboard());
    void queryClient.ensureQueryData(aflQueries.underdogCompliance());
  },
});
