import { useCallback, useMemo } from "react";
import { GameCard, GameCardTBD } from "./game-card";
import { Card, CardContent } from "~/components/ui/card";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import {
  createUnknownAflTeam,
  findAflTeamById,
  formatDateHeader,
  groupGamesByDate,
} from "~/features/afl-tipping/utils/afl-tipping";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";

export function GamesList() {
  const currentRound = useCurrentRound();

  const selectCurrentRoundGames = useCallback(
    (games: AflGame.Type[]) => games.filter(AflGame.byRound(currentRound)),
    [currentRound],
  );

  const { data: games } = useSuspenseQuery({
    ...aflQueries.allGames(),
    select: selectCurrentRoundGames,
  });
  const { data: teams } = useSuspenseQuery(aflQueries.teams());

  const { data: modelTips, isLoading: isPredictionsLoading } = useQuery({
    ...aflQueries.modelTips(currentRound),
  });

  const gameIds = games?.map((g) => g.id);

  const { data: tip } = useQuery({
    ...aflQueries.getTips(gameIds ?? []),
    enabled: !!gameIds,
  });

  const isFirstGame = useMemo(() => {
    const firstGameId = games ? AflGame.getFirstGameOfRound(games)?.id : undefined;
    return AflGame.byId(firstGameId);
  }, [games]);

  if (games.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm sm:text-base">
            No games scheduled for this round.
          </p>
        </CardContent>
      </Card>
    );
  }

  const gamesByDate = groupGamesByDate(games);

  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(gamesByDate)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([date, dateGames]) => (
          <div key={date} className="space-y-2 sm:space-y-3">
            <h3 className="text-base sm:text-lg font-semibold text-muted-foreground border-b pb-1 sm:pb-2 sticky top-0 md:top-16 bg-background z-10 pt-2">
              {formatDateHeader(date)}
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {AflGame.sortByDate(dateGames).map((game) => {
                if (!game.homeTeamId || !game.awayTeamId) {
                  return <GameCardTBD key={game.id} game={game} />;
                }

                return (
                  <GameCard
                    key={game.id}
                    game={game}
                    homeTeam={
                      findAflTeamById(teams, game.homeTeamId) ??
                      createUnknownAflTeam(game.homeTeamId)
                    }
                    awayTeam={
                      findAflTeamById(teams, game.awayTeamId) ??
                      createUnknownAflTeam(game.awayTeamId)
                    }
                    prediction={modelTips?.find((t) => t.gameId === game.id) || undefined}
                    predictionLoading={isPredictionsLoading}
                    tip={tip?.find((t) => t.gameId === game.id)}
                    showMargin={isFirstGame(game)}
                  />
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
