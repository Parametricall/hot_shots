"use client";

import { GameCard } from "./game-card";
import { Card, CardContent } from "~/components/ui/card";
import { AflGame } from "~/features/afl-tipping/types";
import {
  createUnknownAflTeam,
  findAflTeamById,
} from "~/features/afl-tipping/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { useAflServerFns } from "~/features/afl-tipping/providers/afl-server-fns-provider";

// interface GamesListProps {
//   games: AflGame[];
//   tips?: AflTips[];
//   // tips: Record<number, number>;
//   onTipSelect: (gameId: number, teamId: number) => void;
//   teams: AflTeam[];
// }

const groupedByDate = (games: AflGame[]) =>
  games.reduce(
    (acc, item) => {
      // Convert Date to an ISO string without time
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

  const { submitTip } = useAflServerFns();

  const gameIds = games?.map((g) => g.id);

  const { data: tip } = useQuery({
    ...aflQueries.getTips(gameIds ?? []),
    enabled: !!gameIds,
  });

  // const tipsQuery = useQuery({
  //   queryKey: ["tips", games],
  //   queryFn: () =>
  //     games ? getTips({ data: { gameIds: games.map((g) => g.id) } }) : [],
  // });

  // const submitTipFn = useServerFn(submitTip);
  const submitTipMutation = useMutation({
    mutationFn: submitTip,
  });

  const handleTipSelect = async (gameId: number, teamId: number) => {
    submitTipMutation.mutate(
      { data: { gameId, teamId } },
      {
        onSuccess: () => {
          console.log("submit tip mutation success");
        },
      },
    );

    // const { data, error } = await supabaseClient.from("afl_tipping").upsert([
    //   {
    //     game_id: Number(gameId),
    //     tip: Number(teamId),
    //   },
    // ]);
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

  // Group games by date
  const gamesByDate = groupedByDate(games);

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <div className="text-xs sm:text-sm text-muted-foreground">
          {/*{Object.keys(tips).length} of {games.length} tips made*/}
        </div>
      </div>

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
                      tip={tip}
                      // selectedTip={tips[game.id]}
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
