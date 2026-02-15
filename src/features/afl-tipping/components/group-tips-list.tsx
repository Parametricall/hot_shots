"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AflGame, AflGroupTipEntry, AflTeam } from "~/features/afl-tipping/types";
import {
  findAflTeamById,
  createUnknownAflTeam,
  formatDateHeader,
} from "~/features/afl-tipping/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { useGameStartTimer } from "~/features/afl-tipping/hooks/use-game-start-timer";
import { Clock, MapPin } from "lucide-react";
import { cn } from "~/lib/utils";
import { useEffect, useRef } from "react";

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

function UserBadge({ tip, className }: { tip: AflGroupTipEntry; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("gap-1.5 py-1", className)}>
      {tip.avatarUrl ? (
        <img
          src={tip.avatarUrl}
          alt={`${tip.displayName} avatar`}
          className="w-4 h-4 rounded-full"
        />
      ) : (
        <div className="w-4 h-4 rounded-full bg-gray-300" />
      )}
      {tip.displayName}
    </Badge>
  );
}

function SkeletonBadges() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-6 w-24 bg-gray-200 rounded-md animate-pulse" />
      ))}
    </div>
  );
}

function TipsSkeleton() {
  return (
    <div className="px-3 py-2 border-t">
      <SkeletonBadges />
    </div>
  );
}

function PreGameTips({
  tipped,
  notTipped,
}: {
  tipped: AflGroupTipEntry[];
  notTipped: AflGroupTipEntry[];
}) {
  return (
    <div className="px-3 py-2 border-t space-y-2">
      {tipped.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Tipped</div>
          <div className="flex flex-wrap gap-1.5">
            {tipped.map((tip) => (
              <UserBadge key={tip.userId} tip={tip} />
            ))}
          </div>
        </div>
      )}
      {notTipped.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">Not yet tipped</div>
          <div className="flex flex-wrap gap-1.5">
            {notTipped.map((tip) => (
              <UserBadge key={tip.userId} tip={tip} className="opacity-50" />
            ))}
          </div>
        </div>
      )}
      {tipped.length === 0 && notTipped.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-1">No players</div>
      )}
    </div>
  );
}

function PostGameTips({
  tips,
  homeTeam,
  awayTeam,
  winnerTeamId,
}: {
  tips: AflGroupTipEntry[];
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  winnerTeamId: number | null;
}) {
  const homeTips = tips.filter((t) => t.tipTeamId === homeTeam.id);
  const awayTips = tips.filter((t) => t.tipTeamId === awayTeam.id);

  const isComplete = winnerTeamId !== null;

  return (
    <div className="px-3 py-2 border-t space-y-2">
      <TeamTipGroup
        team={homeTeam}
        tips={homeTips}
        isCorrect={isComplete && winnerTeamId === homeTeam.id}
        isComplete={isComplete}
      />
      <TeamTipGroup
        team={awayTeam}
        tips={awayTips}
        isCorrect={isComplete && winnerTeamId === awayTeam.id}
        isComplete={isComplete}
      />
    </div>
  );
}

function TeamTipGroup({
  team,
  tips,
  isCorrect,
  isComplete,
}: {
  team: AflTeam;
  tips: AflGroupTipEntry[];
  isCorrect: boolean;
  isComplete: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md px-2 py-1.5",
        isComplete && isCorrect && "bg-green-50 ring-1 ring-green-300",
        isComplete && !isCorrect && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <img src={team.logo} alt={team.name} className="w-4 h-4" />
        <span className="text-xs font-medium">{team.abbrev}</span>
        <span className="text-xs text-muted-foreground">({tips.length})</span>
      </div>
      {tips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tips.map((tip) => (
            <UserBadge key={tip.userId} tip={tip} />
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground pl-5">No tips</div>
      )}
    </div>
  );
}

function GameGroupTipCard({
  game,
  homeTeam,
  awayTeam,
  tips,
  isLoading,
}: {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tips: AflGroupTipEntry[];
  isLoading: boolean;
}) {
  const hasStarted = useGameStartTimer(game.unixTime);
  const queryClient = useQueryClient();
  const prevHasStarted = useRef(hasStarted);

  useEffect(() => {
    if (hasStarted && !prevHasStarted.current) {
      queryClient.invalidateQueries({ queryKey: aflQueries.allGroupTipsKey() });
    }
    prevHasStarted.current = hasStarted;
  }, [hasStarted, queryClient]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "numeric",
    });
  };

  const tipped = tips.filter((t) => t.hasTipped);
  const notTipped = tips.filter((t) => !t.hasTipped);

  return (
    <Card className="p-0 overflow-hidden rounded-lg">
      <CardContent className="p-0">
        <div className="px-2 py-2 bg-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-600 gap-5">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatTime(game.date)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>
                {game.venue.name}, {game.venue.city}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 py-3 px-4">
          <div className="flex items-center gap-2">
            <img src={homeTeam.logo} alt={homeTeam.name} className="w-8 h-8" />
            <span className="text-sm font-medium">{homeTeam.abbrev}</span>
          </div>
          <span className="text-xs text-muted-foreground">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{awayTeam.abbrev}</span>
            <img src={awayTeam.logo} alt={awayTeam.name} className="w-8 h-8" />
          </div>
        </div>

        {isLoading ? (
          <TipsSkeleton />
        ) : hasStarted ? (
          <PostGameTips
            tips={tipped}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            winnerTeamId={AflGame.isComplete(game) ? game.winnerTeamId : null}
          />
        ) : (
          <PreGameTips tipped={tipped} notTipped={notTipped} />
        )}
      </CardContent>
    </Card>
  );
}

export function GroupTipsList() {
  const currentRound = useCurrentRound();
  const { data: games } = useQuery({
    ...aflQueries.games(currentRound),
  });
  const { data: teams } = useQuery({
    ...aflQueries.teams(),
  });
  const { data: groupTips, isPending: isGroupTipsPending } = useQuery({
    ...aflQueries.groupTips(currentRound),
  });

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

                  const gameTips = (groupTips ?? []).filter((t) => t.gameId === game.id);

                  return (
                    <GameGroupTipCard
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
                      tips={gameTips}
                      isLoading={isGroupTipsPending}
                    />
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}
