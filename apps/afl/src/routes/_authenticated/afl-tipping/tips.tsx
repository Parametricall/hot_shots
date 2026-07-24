import { createFileRoute } from "@tanstack/react-router";
import { MyTips } from "~/features/afl-tipping/pages/my-tips";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";

export const Route = createFileRoute("/_authenticated/afl-tipping/tips")({
  // Fire-and-forget prefetches: don't block navigation (the page has its own
  // suspense skeleton), just start every request the page needs as early as
  // possible instead of letting components discover them in a waterfall.
  loader: ({ context: { queryClient } }) => {
    queryClient.prefetchQuery(aflQueries.teams());
    queryClient
      .ensureQueryData(aflQueries.allGames())
      .then((games) => {
        const round = AflGame.getActiveRound(games);
        if (round == undefined) return;
        queryClient.prefetchQuery(aflQueries.modelTips(round));
        const gameIds = games.filter(AflGame.byRound(round)).map((game) => game.id);
        queryClient.prefetchQuery(aflQueries.getTips(gameIds));
      })
      .catch(() => {
        // Prefetch only — the page's own queries surface any errors
      });
  },
  component: MyTips,
});
