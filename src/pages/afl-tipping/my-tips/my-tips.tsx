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

  if (currentRound == undefined && incompleteGames) {
    setCurrentRound(calculateInitialRound(incompleteGames));
  }

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
