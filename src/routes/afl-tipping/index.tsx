import { createFileRoute } from "@tanstack/react-router";
import { Index } from "~/pages/afl-tipping/index";
import { AflServerFnsProvider } from "~/features/afl-tipping/providers/afl-server-fns-provider";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { AflGame } from "~/features/afl-tipping/types";

export const Route = createFileRoute("/afl-tipping/")({
  component: RouteComponent,
  loader: async ({ context: { queryClient } }) => {
    const teams = queryClient.ensureQueryData(aflQueries.teams());
    void queryClient.ensureQueryData(aflQueries.standings());
    const allGames = queryClient.ensureQueryData(aflQueries.allGames());

    const [allGamesData] = await Promise.all([allGames, teams]);

    const gamesByRound = AflGame.groupByRound(allGamesData);

    // Populate cache for each round
    Object.entries(gamesByRound).forEach(([round, roundGames]) => {
      queryClient.setQueryData(
        aflQueries.games(parseInt(round, 10)).queryKey,
        roundGames,
      );
    });

    await Promise.all(
      Object.values(gamesByRound).map((games) =>
        queryClient.ensureQueryData(aflQueries.getTips(games.map((g) => g.id))),
      ),
    );
  },
});

function RouteComponent() {
  return (
    <AflServerFnsProvider>
      <Index />
    </AflServerFnsProvider>
  );
}
