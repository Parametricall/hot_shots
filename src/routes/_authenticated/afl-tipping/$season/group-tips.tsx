import { createFileRoute } from "@tanstack/react-router";
import { GroupTips } from "~/features/afl-tipping/pages/group-tips";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/_authenticated/afl-tipping/$season/group-tips")({
  loader: ({ params: { season }, context }) => {
    context.queryClient.ensureQueryData(aflQueries.allGames(season));
  },
  component: GroupTips,
});
