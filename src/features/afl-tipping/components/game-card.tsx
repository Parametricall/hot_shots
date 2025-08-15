import { Card, CardContent } from "~/components/ui/card";
import type React from "react";
import { Button } from "~/components/ui/button";
import { Calendar, Clock, MapPin } from "lucide-react";
import { AflGame, AflTeam, Venue } from "~/features/afl-tipping/types";
import { cn } from "~/lib/utils";

function formatLocation(venue: Venue) {
  return `${venue.name}${venue.city ? `, ${venue.city}` : ""}`;
}

interface GameCardProps {
  game: AflGame;
  selectedTip?: number;
  onTipSelect: (gameId: number, teamId: number) => void;
  teams: AflTeam[];
}

export function GameCard({
  game,
  selectedTip,
  onTipSelect,
  teams,
}: GameCardProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "numeric",
    });
  };

  const TeamButton = ({
    teamId,
    isSelected,
    isAwayTeam = false,
  }: {
    teamId: AflTeam["id"];
    isSelected: boolean;
    isAwayTeam?: boolean;
  }) => {
    const aflTeam = teams.find((t) => t.id === teamId);
    return (
      <Button
        // variant={isSelected ? "default" : "outline"}
        className={cn(
          `flex-1 text-black h-auto p-3 sm:p-4 min-w-0 flex flex-row justify-between rounded-none transition-all min-h-[80px] sm:min-h-[90px] bg-transparent`,
          isAwayTeam && "flex-row-reverse",
          // isSelected
          //   ? "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground"
          //   : "hover:bg-accent",
        )}
        onClick={() => onTipSelect(game.id, teamId)}
      >
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
          }`}
        >
          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
        </div>
        <div className="flex flex-col items-center">
          <div
            className={cn(
              `w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold`,
            )}
          >
            <img
              src={aflTeam?.logo}
              alt={`${aflTeam?.name} logo`}
              // className="h-8 w-8"
            />
          </div>
          <span className="text-xs sm:text-sm font-medium text-center leading-tight px-1 text-wrap">
            {aflTeam?.name}
          </span>
        </div>
        <div>50%</div>
      </Button>
    );
  };

  return (
    <Card
      className={`p-0 transition-all overflow-hidden rounded-lg ${selectedTip ? "ring-4 ring-primary/20 shadow-md" : "shadow-none hover:shadow-md"}`}
    >
      <CardContent className="p-0 bg-gray-100">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex -flex-row gap-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(game.date)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatTime(game.date)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{formatLocation(game.venue)}</span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            " from-blue-500 via-50% via-transparent bg-no-repeat rounded-b-lg",
            selectedTip === game.homeTeamId && "bg-gradient-to-r",
            selectedTip === game.awayTeamId && "bg-gradient-to-l",
          )}
        >
          <div className="flex items-center">
            <TeamButton
              // @ts-expect-error - teamId can be undefined
              teamId={game.homeTeamId}
              isSelected={selectedTip === game.homeTeamId}
            />

            <TeamButton
              // @ts-expect-error - teamId can be undefined
              teamId={game.awayTeamId}
              isSelected={selectedTip === game.awayTeamId}
              isAwayTeam
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
