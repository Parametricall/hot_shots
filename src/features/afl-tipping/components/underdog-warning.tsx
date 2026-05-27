import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { GameRules } from "~/features/afl-tipping/api/game-rules";

export function UnderdogWarning() {
  const currentRound = useCurrentRound();

  const { data: roundGames } = useQuery({
    ...aflQueries.allGames(),
    select: (games) => games.filter(AflGame.byRound(currentRound)),
  });

  const gameIds = useMemo(() => roundGames?.map((g) => g.id) ?? [], [roundGames]);

  const { data: tip } = useQuery({
    ...aflQueries.getTips(gameIds),
    enabled: gameIds.length > 0,
  });

  const isFinals = roundGames?.some((g) => g.isFinals) ?? false;

  const underdogCount = useMemo(
    () => (tip ? tip.filter((t) => t.isUnderdog === true).length : 0),
    [tip],
  );

  const showUnderdogWarning =
    !!tip && !isFinals && underdogCount < GameRules.MINIMUM_UNDERDOGS_PER_ROUND;

  if (!showUnderdogWarning) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        You&#39;ve tipped {underdogCount} underdog{underdogCount !== 1 ? "s" : ""} this round. The
        minimum is {GameRules.MINIMUM_UNDERDOGS_PER_ROUND}. Don&#39;t be a shit bloke.
      </span>
    </div>
  );
}
