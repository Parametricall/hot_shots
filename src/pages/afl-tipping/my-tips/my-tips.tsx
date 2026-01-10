import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { aflGamesToRounds } from "~/features/afl-tipping/utils";
import { useState } from "react";
import { AflGame } from "~/features/afl-tipping/types";
import { GamesList } from "~/features/afl-tipping/components/games-list";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";

function calculateInitialRound(incompleteGames: AflGame[]) {
  if (incompleteGames.length === 0) return 0;
  return incompleteGames[0].round;
}

export function MyTips() {
  const currentRoundState = useState<number>();
  const [currentRound, setCurrentRound] = currentRoundState;
  const { data: incompleteGames } = useQuery({
    ...aflQueries.incompleteGames(),
  });

  const { data: rounds } = useQuery({
    ...aflQueries.allGames(),
    select: aflGamesToRounds,
  });

  // const { data: games } = useQuery(aflQueries.games(currentRound));
  // const { data: teams } = useQuery(aflQueries.teams());
  // const { data: tips } = useQuery({
  //   ...aflQueries.tips(currentRound!),
  //   enabled: currentRound != undefined,
  // });

  // const currentRoundData = rounds?.[currentRound ?? 0];

  if (currentRound == undefined && incompleteGames) {
    setCurrentRound(calculateInitialRound(incompleteGames));
  }

  // const { submitTip } = useAflServerFns();

  // const submitTipFn = useServerFn(submitTip);
  // const submitTipMutation = useMutation({
  //   mutationFn: submitTipFn,
  // });
  //
  // const handleTipSelect = async (gameId: number, teamId: number) => {
  //   submitTipMutation.mutate(
  //     { data: { gameId, teamId } },
  //     {
  //       onSuccess: () => {
  //         console.log("submit tip mutation success");
  //       },
  //     },
  //   );
  //
  //   // const { data, error } = await supabaseClient.from("afl_tipping").upsert([
  //   //   {
  //   //     game_id: Number(gameId),
  //   //     tip: Number(teamId),
  //   //   },
  //   // ]);
  // };

  // if (!games || !teams || !currentRound) return null;

  if (currentRound == undefined) return "No round";
  if (!rounds) return "No rounds data";

  return (
    <CurrentRoundProvider state={currentRound}>
      <div className="space-y-4 sm:space-y-6">
        <RoundNavigation
          rounds={rounds}
          currentRound={currentRound}
          onRoundChange={setCurrentRound}
        />
        <GamesList
        // games={games}
        // roundName={rounds[currentRound].name}
        // // tips={currentRoundTips}
        // onTipSelect={handleTipSelect}
        // teams={teams}
        // tips={tips}
        />
      </div>
    </CurrentRoundProvider>
  );
}
