import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { aflGamesToRounds } from "~/features/afl-tipping/utils";
import { useMemo, useState } from "react";
import { AflGame } from "~/features/afl-tipping/types";
import { GamesList } from "~/features/afl-tipping/components/games-list";
import { CurrentRoundProvider } from "~/features/afl-tipping/providers/current-round-provider";

export function MyTips() {
  const currentRoundState = useState<number>();
  const [currentRound, setCurrentRound] = currentRoundState;

  const { data: games } = useQuery({
    ...aflQueries.allGames(),
  });

  const rounds = useMemo(() => (games ? aflGamesToRounds(games) : undefined), [games]);

  if (currentRound == undefined && games) {
    setCurrentRound(AflGame.getActiveRound(games));
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
        <GamesList />
      </div>
    </CurrentRoundProvider>
  );
}
