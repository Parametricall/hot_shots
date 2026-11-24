import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { useNow } from "~/features/afl-tipping/hooks/use-now";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { UnderdogWarning } from "~/features/afl-tipping/components/underdog-warning";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { roundStatus, roundStatusText } from "~/features/afl-tipping/utils/round-status";

type RoundStatusLineProps = {
  /** Show the Underdog quota chip: only on My Tips, where the Tipster can act on it. */
  showUnderdogs?: boolean;
};

/**
 * One slim line under the Round chips: how many of the Round's Games the Tipster has tipped and
 * the countdown to the next Lockout ("6/9 tipped · Locks Thu 7:40pm (2d 3h)"), or "Round locked"
 * / "Round complete". The Underdog quota chip sits on the end of it.
 */
export function RoundStatusLine({ showUnderdogs = false }: RoundStatusLineProps) {
  const season = useSeason();
  const round = useCurrentRound();
  const at = useNow();

  const { data: games } = useQuery({
    ...aflQueries.allGames(season),
    select: (all) => all.filter(AflGame.byRound(round)),
  });
  const gameIds = useMemo(() => games?.map((game) => game.id) ?? [], [games]);
  const { data: tips } = useQuery({
    ...aflQueries.getTips(season, gameIds),
    enabled: gameIds.length > 0,
  });

  const status = useMemo(
    () => (games && tips ? roundStatus(games, tips, at) : null),
    [games, tips, at],
  );

  if (!status) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-muted-foreground">
      <p className="tabular-nums">{roundStatusText(status, at)}</p>
      {showUnderdogs && <UnderdogWarning />}
    </div>
  );
}
