"use client";

import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { AflGame, AflGroupTipEntry, AflTeam } from "~/features/afl-tipping/types";
import {
  findAflTeamById,
  createUnknownAflTeam,
  formatDateHeader,
  groupGamesByDate,
  formatTime,
} from "~/features/afl-tipping/utils";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { useGameStartTimer } from "~/features/afl-tipping/hooks/use-game-start-timer";
import { Clock, MapPin } from "lucide-react";
import { cn } from "~/lib/utils";
import { useCallback, useEffect, useRef } from "react";

function UserBadge({
  tip,
  showMargin,
  className,
}: {
  tip: AflGroupTipEntry;
  showMargin?: boolean;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("gap-1.5 py-1", className)}>
      {tip.displayName}
      {showMargin && tip.margin != null && (
        <span className="text-muted-foreground font-normal">({tip.margin}pts)</span>
      )}
      {tip.hasMargin === false && (
        <span className="text-red-500 font-normal text-xs" title="No margin set">
          ! no margin
        </span>
      )}
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
  isMarginGame,
}: {
  tips: AflGroupTipEntry[];
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  winnerTeamId: number | null;
  isMarginGame?: boolean;
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
        showMargin={isMarginGame}
      />
      <TeamTipGroup
        team={awayTeam}
        tips={awayTips}
        isCorrect={isComplete && winnerTeamId === awayTeam.id}
        isComplete={isComplete}
        showMargin={isMarginGame}
      />
    </div>
  );
}

function TeamTipGroup({
  team,
  tips,
  isCorrect,
  isComplete,
  showMargin,
}: {
  team: AflTeam;
  tips: AflGroupTipEntry[];
  isCorrect: boolean;
  isComplete: boolean;
  showMargin?: boolean;
}) {
  const sortedTips = [...tips].sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));

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
      {sortedTips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {sortedTips.map((tip) => (
            <UserBadge key={tip.userId} tip={tip} showMargin={showMargin} />
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
  isMarginGame,
}: {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tips: AflGroupTipEntry[];
  isLoading: boolean;
  isMarginGame?: boolean;
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
            isMarginGame={isMarginGame}
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

  const selectCurrentRoundGames = useCallback(
    (games: AflGame[]) => games.filter((g) => g.round === currentRound),
    [currentRound],
  );

  const { data: games } = useSuspenseQuery({
    ...aflQueries.allGames(),
    select: selectCurrentRoundGames,
  });
  const { data: teams } = useSuspenseQuery(aflQueries.teams());
  const { data: groupTips, isPending: isGroupTipsPending } = useQuery({
    ...aflQueries.groupTips(currentRound),
  });

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
  const firstGameId = AflGame.getFirstGameOfRound(games)?.id;

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
                      isMarginGame={game.id === firstGameId}
                    />
                  );
                })}
            </div>
          </div>
        ))}
    </div>
  );
}
