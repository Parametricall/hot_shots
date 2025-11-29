import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { GamesList } from "~/features/afl-tipping/components/games-list";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useQuery } from "@tanstack/react-query";
import { aflGamesToRounds } from "~/features/afl-tipping/utils";
import {useSupabaseClient} from "~/lib/supabaseClient";

export const Route = createFileRoute("/afl-tipping")({
  component: RouteComponent,
  loader: async ({ context: { queryClient } }) => {
    const teams = queryClient.ensureQueryData(aflQueries.teams());
    const allGames = queryClient.ensureQueryData(aflQueries.allGames());
    const incompleteGames = queryClient.ensureQueryData(
      aflQueries.incompleteGames(),
    );

    const [teamsData, allGamesData, incompleteGamesData] = await Promise.all([
      teams,
      allGames,
      incompleteGames,
    ]);

    return {
      teams: teamsData,
      allGames: allGamesData,
      incompleteGames: incompleteGamesData,
    };
  },
});

function RouteComponent() {
  const { teams, incompleteGames } = Route.useLoaderData();
  const [currentRound, setCurrentRound] = useState(() => {
    if (incompleteGames.length === 0) return 0;
    // Find the earliest round with incomplete games
    return incompleteGames[0].round;
  });
  // const [tips, setTips] = useLocalStorage<
  //   Record<string, Record<number, number>>
  // >("afl-tips-2024", {});

  const { data: rounds } = useQuery({
    ...aflQueries.allGames(),
    select: aflGamesToRounds,
    initialData: [], // This should already be in the cache
  });

  const { data: games } = useQuery(aflQueries.games(currentRound));
  const { data: tips } = useQuery(aflQueries.tips(currentRound));

  const currentRoundData = rounds[currentRound];

  const supabaseClient = useSupabaseClient()

  const handleTipSelect = async (gameId: number, teamId: number) => {
      const {data, error} = await supabaseClient
          .from("afl_tipping")
          .upsert([
              {
                  game_id: Number(gameId),
                  tip: Number(teamId),
              },
          ]);



  //   setTips((prev) => {
  //     const newTips = { ...prev };
  //
  //     // Handle clearing tips when empty string is passed
  //     // if (teamId === "") {
  //     //   if (newTips[currentRound]) {
  //     //     delete newTips[currentRound][gameId];
  //     //     // Remove round entry if no tips left
  //     //     if (Object.keys(newTips[currentRound]).length === 0) {
  //     //       delete newTips[currentRound];
  //     //     }
  //     //   }
  //     // } else {
  //     newTips[currentRound] = {
  //       ...newTips[currentRound],
  //       [gameId]: teamId,
  //     };
  //     // }
  //
  //     return newTips;
  //   });
  };

  // const handleClearRoundTips = () => {
  //   setTips((prev) => {
  //     const newTips = { ...prev };
  //     delete newTips[currentRound];
  //     return newTips;
  //   });
  // };

  // const handleResetAllTips = () => {
  //   setTips({});
  // };

  // const currentRoundTips = tips[currentRound] || {};

  return (
    <div className="min-h-screen ">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                AFL Tipping
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Make your tips for the 2024 season
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              // onClick={handleResetAllTips}
              className="text-muted-foreground hover:text-foreground bg-transparent"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Reset All</span>
            </Button>
          </div>
        </header>

        <RoundNavigation
          currentRound={currentRound}
          onRoundChange={setCurrentRound}
        />

        {/*{currentRoundData && (*/}
        {/*  <TipSummary*/}
        {/*    games={currentRoundData.games}*/}
        {/*    // tips={currentRoundTips}*/}
        {/*    roundName={rounds[currentRound].name}*/}
        {/*    // onClearTips={handleClearRoundTips}*/}
        {/*  />*/}
        {/*)}*/}

        {currentRoundData && games && (
          <GamesList
            games={games}
            roundName={rounds[currentRound].name}
            // tips={currentRoundTips}
            onTipSelect={handleTipSelect}
            teams={teams}
            tips={tips}
          />
        )}
      </div>
    </div>
  );
}
