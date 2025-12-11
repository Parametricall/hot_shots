import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { aflGamesToRounds } from "~/features/afl-tipping/utils";
import { Button } from "~/components/ui/button";
import { RotateCcw } from "lucide-react";
import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { GamesList } from "~/features/afl-tipping/components/games-list";
import { useAflPersistence } from "~/features/afl-tipping/providers/afl-persistance-provider";
import { AflGame, AflTeam } from "~/features/afl-tipping/types";

type TipsProps = {
  teams: AflTeam[];
  incompleteGames: AflGame[];
};

export function Tips({ teams, incompleteGames }: TipsProps) {
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

  const { selectTips } = useAflPersistence();

  const handleTipSelect = async (gameId: number, teamId: number) => {
    const res = await selectTips(gameId, teamId);

    // const { data, error } = await supabaseClient.from("afl_tipping").upsert([
    //   {
    //     game_id: Number(gameId),
    //     tip: Number(teamId),
    //   },
    // ]);
  };

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
