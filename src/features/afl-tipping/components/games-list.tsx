"use client";

import { GameCard } from "./game-card";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { AflGame, AflTeam } from "~/features/afl-tipping/types";

interface GamesListProps {
  games: AflGame[];
  roundName: string;
  tips: Record<string, string>;
  onTipSelect: (gameId: string, teamId: string) => void;
  teams: AflTeam[];
}

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

export function GamesList({
  games,
  roundName,
  tips,
  onTipSelect,
  teams,
}: GamesListProps) {
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

  if (games.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">{roundName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm sm:text-base">
            No games scheduled for this round.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold">{roundName}</h2>
        <div className="text-xs sm:text-sm text-muted-foreground">
          {Object.keys(tips).length} of {games.length} tips made
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
                .map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    selectedTip={tips[game.id]}
                    onTipSelect={onTipSelect}
                    teams={teams}
                  />
                ))}
            </div>
          </div>
        ))}
    </div>
  );
}
