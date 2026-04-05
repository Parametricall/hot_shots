import { createFileRoute } from "@tanstack/react-router";
import { MyTips } from "~/features/afl-tipping/pages/my-tips";
import { aflQueries } from "~/features/afl-tipping/api/queries";

export const Route = createFileRoute("/_authenticated/afl-tipping/tips")({
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(aflQueries.allGames());
  },
  component: MyTips,
});
