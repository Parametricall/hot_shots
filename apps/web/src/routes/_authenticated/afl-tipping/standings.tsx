import { createFileRoute } from "@tanstack/react-router";
import { Standings } from "~/features/afl-tipping/components/standings";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/_authenticated/afl-tipping/standings")({
  component: Standings,
  loader: async ({ context: { queryClient } }) => {
    void queryClient.ensureQueryData(aflQueries.standings());
  },
});
