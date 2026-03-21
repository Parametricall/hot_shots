import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Header } from "~/components/header";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { AflGame } from "~/features/afl-tipping/types";

const TABS = [
  { id: "tips", label: "My Tips" },
  { id: "group-tips", label: "Player Tips" },
  { id: "standings", label: "Standings" },
  { id: "leaderboard", label: "Leaderboard" },
] as const;

export const Route = createFileRoute("/_authenticated/afl-tipping")({
  component: AflTippingLayout,
  loader: async ({ context: { queryClient } }) => {
    const [allGamesData] = await Promise.all([
      queryClient.ensureQueryData(aflQueries.allGames()),
      queryClient.ensureQueryData(aflQueries.teams()),
    ]);

    const gamesByRound = AflGame.groupByRound(allGamesData);

    Object.entries(gamesByRound).forEach(([round, roundGames]) => {
      queryClient.setQueryData(aflQueries.games(parseInt(round, 10)).queryKey, roundGames);
    });

    // Only prefetch tips for the active round — other rounds load on demand
    const activeRound = AflGame.getActiveRound(allGamesData);
    const activeRoundGames = gamesByRound[activeRound];
    if (activeRoundGames) {
      await queryClient.ensureQueryData(aflQueries.getTips(activeRoundGames.map((g) => g.id)));
    }
  },
});

function AflTippingLayout() {
  const { location } = useRouterState();
  const activeTab = location.pathname.split("/").pop() ?? "tips";

  return (
    <div className="px-2">
      <Header />
      <hr />
      <div className="h-full container mx-auto py-2">
        <Tabs value={activeTab}>
          <TabsList className="w-full">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} asChild>
                <Link to={`/afl-tipping/${tab.id}`}>{tab.label}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex-1 pt-2">
            <Outlet />
          </div>
        </Tabs>
      </div>
    </div>
  );
}
