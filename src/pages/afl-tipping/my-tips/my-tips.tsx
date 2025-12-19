import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { aflGamesToRounds } from "~/features/afl-tipping/utils";
import { useState } from "react";
import { AflGame } from "~/features/afl-tipping/types";

function calculateInitialRound(incompleteGames: AflGame[]) {
  if (incompleteGames.length === 0) return 0;
  return incompleteGames[0].round;
}

export function MyTips() {
  const [currentRound, setCurrentRound] = useState<number>();
  const { data: incompleteGames } = useQuery({
    ...aflQueries.incompleteGames(),
  });

  if (currentRound == undefined && incompleteGames) {
    setCurrentRound(calculateInitialRound(incompleteGames));
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <RoundNavigation
        currentRound={currentRound}
        onRoundChange={setCurrentRound}
      />
    </div>
  );
}
