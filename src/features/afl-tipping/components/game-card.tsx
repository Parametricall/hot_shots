import { Card, CardContent } from "~/components/ui/card";
import React, { ComponentProps, createContext, PropsWithChildren, useContext } from "react";
import { Button } from "~/components/ui/button";
import { Calendar, Check, Clock, MapPin, X } from "lucide-react";
import { AflGame, AflModelTip, AflTeam, AflUserTip } from "~/features/afl-tipping/types";
import { cn } from "~/lib/utils";
import { useGameStartTimer } from "~/features/afl-tipping/hooks/use-game-start-timer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

// Context for sharing game data across composed components
interface GameCardContextValue {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  onTipSelect: (gameId: number, teamId: number) => void;
}

const GameCardContext = createContext<GameCardContextValue | null>(null);

const useGameCard = () => {
  const context = useContext(GameCardContext);
  if (!context) {
    throw new Error("GameCard components must be used within GameCard.Root");
  }
  return context;
};

// Root component
interface GameCardRootProps extends PropsWithChildren {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  onTipSelect: (gameId: number, teamId: number) => void;
  className?: string;
}

function GameCardRoot({
  children,
  game,
  homeTeam,
  awayTeam,
  tip,
  prediction,
  onTipSelect,
  className,
}: GameCardRootProps) {
  return (
    <GameCardContext.Provider value={{ game, homeTeam, awayTeam, tip, prediction, onTipSelect }}>
      <Card className={cn("p-0 transition-all overflow-hidden rounded-lg", className)}>
        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </GameCardContext.Provider>
  );
}

// Header component with game metadata
function GameCardHeader({ className }: { className?: string }) {
  const { game } = useGameCard();

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

  return (
    <div className={cn("px-2 py-2 bg-gray-100", className)}>
      <div className="flex items-center justify-between text-xs text-gray-600 gap-5">
        <div className="flex -flex-row gap-2">
          <div className="flex items-center gap-1">
            <Calendar className="hidden sm:inline-block h-3 w-3" />
            <span>{formatDate(game.date)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatTime(game.date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>
            <span>{game.venue.name}</span>
            <span className="hidden md:inline-block">, {game.venue.city}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// Team button component
interface TeamButtonProps {
  team: AflTeam;
  isAwayTeam?: boolean;
  className?: string;
}

function GameCardTeamButton({ team, isAwayTeam = false, className }: TeamButtonProps) {
  const { game, prediction, tip, onTipSelect } = useGameCard();
  const isGameStarted = useGameStartTimer(game.unixTime);
  const disabled = isGameStarted;

  const isSelected = tip?.tipTeamId === team.id;
  const displayValue = isGameStarted
    ? isAwayTeam
      ? game.awayScore
      : game.homeScore
    : isAwayTeam
      ? `${Math.round(prediction?.awayConfidence ?? 0)}%`
      : `${Math.round(prediction?.homeConfidence ?? 0)}%`;

  return (
    <Button
      className={cn(
        "flex-1 text-black h-auto p-2 min-w-0 flex flex-row justify-between rounded-none transition-all min-h-20 sm:min-h-22.5 bg-transparent hover:bg-inherit sm:hover:bg-blue-200 hover:cursor-pointer shadow-none",
        isAwayTeam && "flex-row-reverse",
        className,
      )}
      onClick={() => onTipSelect(game.id, team.id)}
      disabled={disabled}
    >
      <div
        className={cn(
          `aspect-square flex sm:flex w-4 h-4 rounded-full border-2 items-center justify-center`,
          isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300",
        )}
      >
        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
          <img src={team.logo} alt={`${team.name} logo`} />
        </div>
        <span className="hidden sm:inline-block text-xs sm:text-sm font-medium text-center leading-tight px-1 text-wrap">
          {team.name}
        </span>
      </div>

      <div className="sm:hidden font-semibold text-lg">{displayValue}</div>
      <div className="hidden sm:inline font-semibold text-2xl">{displayValue}</div>
    </Button>
  );
}

// Matchup section - no accordion dependencies
interface GameCardMatchupProps {
  className?: string;
  children?: React.ReactNode;
}

function GameCardMatchup({ className, children }: GameCardMatchupProps) {
  const { homeTeam, awayTeam } = useGameCard();

  return (
    <div className={cn("from-blue-300 via-50% via-transparent bg-no-repeat", className)}>
      <div className="flex">
        <GameCardTeamButton team={homeTeam} />
        {children}
        <GameCardTeamButton team={awayTeam} isAwayTeam />
      </div>
    </div>
  );
}

function GameCardSeparatorTime({ className, ...divProps }: ComponentProps<"div">) {
  const { game } = useGameCard();
  return (
    <div {...divProps} className={cn("text-xs", className)}>
      {game.timeStr}
    </div>
  );
}

// Separator component for between teams (can be customized)
function GameCardSeparator({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 p-2 sm:px-4", className)}>
      {children}
    </div>
  );
}

// Stats section component
function GameCardStats({ className }: { className?: string }) {
  const { homeTeam, awayTeam } = useGameCard();

  return (
    <div className={cn("p-2 bg-gray-50 border-t", className)}>
      <div className="text-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-row justify-around gap-2 items-center sm:hidden">
            <div className="text-sm font-semibold">{homeTeam.name}</div>
            <div className="font-medium">VS</div>
            <div className="text-sm font-semibold">{awayTeam.name}</div>
          </div>

          <div className="flex flex-row justify-around gap-2 items-center">
            <div className="text-xs flex flex-row items-center gap-1">
              {[true, true, true, true, false].map((isWin, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-center w-4 h-4 rounded",
                    isWin ? "bg-green-500" : "bg-red-500",
                  )}
                >
                  {isWin ? (
                    <Check size={12} className="text-white" strokeWidth={2} />
                  ) : (
                    <X size={12} className="text-white" strokeWidth={2} />
                  )}
                </div>
              ))}
            </div>

            <div className="font-medium">Last 5 Games</div>
            <div className="text-xs">L-W-W-L-W</div>
          </div>

          <div className="flex flex-row justify-around gap-2 items-center">
            <div className="text-xs">W</div>
            <div className="flex flex-col items-center justify-center">
              <div className="font-medium">H2H</div>
              <div className="text-xs">{homeTeam.name} won by 12</div>
            </div>
            <div className="text-xs">L</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Default composed GameCard WITH accordion
interface GameCardProps {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  onTipSelect: (gameId: number, teamId: number) => void;
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  prediction,
  tip,
  onTipSelect,
}: GameCardProps) {
  return (
    <GameCardRoot
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      prediction={prediction}
      tip={tip}
      onTipSelect={onTipSelect}
    >
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1">
          <GameCardHeader />
          <GameCardMatchup>
            <GameCardSeparator>
              <GameCardSeparatorTime />
              <AccordionTrigger className="flex flex-col items-center justify-center gap-0 p-0 text-[10px] uppercase hover:no-underline cursor-pointer text-wrap">
                Game Info
              </AccordionTrigger>
            </GameCardSeparator>
          </GameCardMatchup>
          <AccordionContent>
            <GameCardStats />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </GameCardRoot>
  );
}

// Simple version WITHOUT accordion
export function GameCardSimple({
  game,
  homeTeam,
  awayTeam,
  prediction,
  tip,
  onTipSelect,
}: GameCardProps) {
  return (
    <GameCardRoot
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      prediction={prediction}
      tip={tip}
      onTipSelect={onTipSelect}
    >
      <GameCardHeader />
      <GameCardMatchup>
        <GameCardSeparator>
          <GameCardSeparatorTime />
        </GameCardSeparator>
      </GameCardMatchup>
    </GameCardRoot>
  );
}

// Export individual components for custom compositions
GameCard.Root = GameCardRoot;
GameCard.Header = GameCardHeader;
GameCard.Matchup = GameCardMatchup;
GameCard.Separator = GameCardSeparator;
GameCard.TeamButton = GameCardTeamButton;
GameCard.Stats = GameCardStats;
GameCard.Simple = GameCardSimple;
