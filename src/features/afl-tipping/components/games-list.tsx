"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameCard } from "./game-card";
import { Card, CardContent } from "~/components/ui/card";
import { AflGame } from "~/features/afl-tipping/types";
import {
  createUnknownAflTeam,
  findAflTeamById,
  formatDateHeader,
  groupGamesByDate,
} from "~/features/afl-tipping/utils";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { useTipMutation } from "~/features/afl-tipping/hooks/use-tip-mutation";

export function GamesList() {
  const currentRound = useCurrentRound();
  const { data: games } = useQuery({
    ...aflQueries.games(currentRound),
  });
  const { data: teams } = useQuery({
    ...aflQueries.teams(),
  });

  const { data: modelTips, isLoading: isPredictionsLoading } = useQuery({
    ...aflQueries.modelTips(currentRound),
  });

  const gameIds = games?.map((g) => g.id);

  const { data: tip } = useQuery({
    ...aflQueries.getTips(gameIds ?? []),
    enabled: !!gameIds,
  });

  const firstGameId = useMemo(
    () => (games ? AflGame.getFirstGameOfRound(games)?.id : undefined),
    [games],
  );

  const [margin, setMargin] = useState<number | undefined>(() => {
    const firstTip = tip?.find((t) => t.gameId === firstGameId);
    return firstTip?.margin;
  });

  // Sync margin from server when tips load or round changes
  const serverMargin = tip?.find((t) => t.gameId === firstGameId)?.margin;
  const [lastSyncedMargin, setLastSyncedMargin] = useState<number | undefined>(undefined);
  const [lastSyncedFirstGameId, setLastSyncedFirstGameId] = useState<number | undefined>(undefined);
  if (serverMargin !== lastSyncedMargin || firstGameId !== lastSyncedFirstGameId) {
    setLastSyncedMargin(serverMargin);
    setLastSyncedFirstGameId(firstGameId);
    setMargin(serverMargin);
  }

  const submitTipMutation = useTipMutation({ gameIds });

  const handleTipSelect = useCallback(
    (gameId: number, teamId: number) => {
      submitTipMutation.mutate({
        data: {
          gameId,
          teamId,
          margin: gameId === firstGameId ? margin : undefined,
        },
      });
    },
    [submitTipMutation, firstGameId, margin],
  );

  const marginTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save margin to server (called directly or after debounce)
  const saveMargin = useCallback(
    (marginValue: number | undefined) => {
      if (!firstGameId) return;
      const existingTip = tip?.find((t) => t.gameId === firstGameId);
      if (existingTip) {
        submitTipMutation.mutate({
          data: {
            gameId: firstGameId,
            teamId: existingTip.tipTeamId,
            margin: marginValue,
          },
        });
      }
    },
    [firstGameId, tip, submitTipMutation],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (marginTimerRef.current) clearTimeout(marginTimerRef.current);
    };
  }, []);

  const handleMarginChange = useCallback(
    (newMargin: number | undefined) => {
      setMargin(newMargin);
      if (marginTimerRef.current) clearTimeout(marginTimerRef.current);
      marginTimerRef.current = setTimeout(() => saveMargin(newMargin), 500);
    },
    [saveMargin],
  );

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

  const gamesByDate = groupGamesByDate(games);

  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(gamesByDate)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([date, dateGames]) => (
          <div key={date} className="space-y-2 sm:space-y-3">
            <h3 className="text-base sm:text-lg font-semibold text-muted-foreground border-b pb-1 sm:pb-2 sticky top-16 bg-background z-10 pt-2">
              {formatDateHeader(date)}
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {dateGames
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((game) => {
                  if (!game.homeTeamId || !game.awayTeamId) {
                    return (
                      <div key={game.id} className="text-red-500 text-sm sm:text-base">
                        Game {game.id} is missing team IDs.
                      </div>
                    );
                  }

                  const isMarginGame = game.id === firstGameId;

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
                      isMarginGame={isMarginGame}
                      margin={isMarginGame ? margin : undefined}
                      onMarginChange={isMarginGame ? handleMarginChange : undefined}
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
