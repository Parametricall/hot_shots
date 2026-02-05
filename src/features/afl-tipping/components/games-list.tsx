"use client";

import { GameCard } from "./game-card";
import { Card, CardContent } from "~/components/ui/card";
import { AflGame } from "~/features/afl-tipping/types";
import {
  createUnknownAflTeam,
  findAflTeamById,
  formatDateHeader,
} from "~/features/afl-tipping/utils";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { useTipMutation } from "~/features/afl-tipping/hooks/use-tip-mutation";

const groupedByDate = (games: AflGame[]) =>
  games.reduce(
    (acc, item) => {
      const key = item.date.toISOString().split("T")[0];

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);

      return acc;
    },
    {} as Record<string, AflGame[]>,
  );

export function GamesList() {
  const currentRound = useCurrentRound();
  const { data: games } = useQuery({
    ...aflQueries.games(currentRound),
  });
  const { data: teams } = useQuery({
    ...aflQueries.teams(),
  });

  const { data: modelTips } = useQuery({
    ...aflQueries.modelTips(currentRound),
  });

  const gameIds = games?.map((g) => g.id);

  const { data: tip } = useQuery({
    ...aflQueries.getTips(gameIds ?? []),
    enabled: !!gameIds,
  });

  const submitTipMutation = useTipMutation({ gameIds });

  const handleTipSelect = (gameId: number, teamId: number) => {
    submitTipMutation.mutate({ data: { gameId, teamId } });
  };

  if (!games || !teams || games.length === 0) {
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

  const gamesByDate = groupedByDate(games);

  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(gamesByDate)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([date, dateGames]) => (
          <div key={date} className="space-y-2 sm:space-y-3">
            <h3 className="text-base sm:text-lg font-semibold text-muted-foreground border-b pb-1 sm:pb-2">
              {formatDateHeader(date)}
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {dateGames
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((game) => {
                  if (!game.homeTeamId || !game.awayTeamId) {
                    return (
                      <div
                        key={game.id}
                        className="text-red-500 text-sm sm:text-base"
                      >
                        Game {game.id} is missing team IDs.
                      </div>
                    );
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
                      prediction={
                        modelTips?.find((t) => t.gameId === game.id) ||
                        undefined
                      }
                      tip={tip?.[0]}
                      onTipSelect={handleTipSelect}
                    />
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}
