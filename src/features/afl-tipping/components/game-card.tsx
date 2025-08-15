import { Card, CardContent } from "~/components/ui/card";
import type React from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Calendar, Clock, MapPin, X } from "lucide-react";
import { AflGame, AflTeam, Venue } from "~/features/afl-tipping/types";

function formatLocation(venue: Venue) {
  return `${venue.name}${venue.city ? `, ${venue.city}` : ""}`;
}

interface GameCardProps {
  game: AflGame;
  selectedTip?: string;
  onTipSelect: (gameId: string, teamId: string) => void;
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

  // Added function to clear tip for this game
  const handleClearTip = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear tip by setting empty string - parent component will handle removal
    onTipSelect(game.id.toString(), "");
  };

  const TeamButton = ({
    teamId,
    isSelected,
  }: {
    teamId: AflTeam["id"];
    isSelected: boolean;
  }) => {
    const aflTeam = teams.find((t) => t.id === teamId);
    return (
      <Button
        variant={isSelected ? "default" : "outline"}
        className={`flex-1 h-auto p-3 sm:p-4 flex flex-col items-center gap-2 transition-all min-h-[80px] sm:min-h-[90px] ${
          isSelected
            ? "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground"
            : "hover:bg-accent"
        }`}
        onClick={() => onTipSelect(game.id.toString(), teamId.toString())}
      >
        <div
          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold ${
            isSelected ? "ring-2 ring-white ring-offset-2" : ""
          }`}
          // style={{ backgroundColor: team.colors.primary }}
        >
          <img
            src={aflTeam?.logo}
            alt={`${aflTeam?.name} logo`}
            // className="h-8 w-8"
          />
        </div>
        <span className="text-xs sm:text-sm font-medium text-center leading-tight px-1">
          {aflTeam?.name}
        </span>
      </Button>
    );
  };

  return (
    <Card
      className={`mb-3 sm:mb-4 transition-all ${selectedTip ? "ring-1 ring-primary/20 shadow-md" : "shadow-sm hover:shadow-md"}`}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-row justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{formatDate(game.date)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{formatTime(game.date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{formatLocation(game.venue)}</span>
            </div>
            {/* Added clear tip button when tip is selected */}
            {selectedTip && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearTip}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <TeamButton
            // @ts-expect-error - teamId can be undefined
            teamId={game.homeTeamId}
            isSelected={selectedTip === game.homeTeamId?.toString()}
          />

          <div className="flex flex-col items-center px-1 sm:px-2 min-w-[40px]">
            <span className="text-xs text-muted-foreground mb-1">VS</span>
            {selectedTip && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {selectedTip === game.homeTeamId?.toString() ? "HOME" : "AWAY"}
              </Badge>
            )}
          </div>

          <TeamButton
            // @ts-expect-error - teamId can be undefined
            teamId={game.awayTeamId}
            isSelected={selectedTip === game.awayTeamId?.toString()}
          />
        </div>
      </CardContent>
    </Card>
  );
}
