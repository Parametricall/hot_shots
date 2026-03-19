import { Card, CardContent } from "~/components/ui/card";
import React, {
  ComponentProps,
  createContext,
  PropsWithChildren,
  useContext,
  useState,
} from "react";
import { Button } from "~/components/ui/button";
import { Check, Clock, Lock, MapPin, Minus, Plus, X } from "lucide-react";
import logo from "/dummy-footy-logo.png?url";
import { AflGame, AflModelTip, AflTeam, AflUserTip } from "~/features/afl-tipping/types";
import { cn } from "~/lib/utils";
import { useGameStartTimer } from "~/features/afl-tipping/hooks/use-game-start-timer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";

// Context for sharing game data across composed components
interface GameCardContextValue {
  game: AflGame;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  predictionLoading?: boolean;
  isMarginGame?: boolean;
  margin?: number;
  onMarginChange?: (margin: number | undefined) => void;
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
  predictionLoading?: boolean;
  isMarginGame?: boolean;
  margin?: number;
  onMarginChange?: (margin: number | undefined) => void;
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
  predictionLoading,
  isMarginGame,
  margin,
  onMarginChange,
  onTipSelect,
  className,
}: GameCardRootProps) {
  return (
    <GameCardContext.Provider
      value={{
        game,
        homeTeam,
        awayTeam,
        tip,
        prediction,
        predictionLoading,
        isMarginGame,
        margin,
        onMarginChange,
        onTipSelect,
      }}
    >
      <Card className={cn("p-0 transition-all overflow-hidden rounded-lg", className)}>
        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </GameCardContext.Provider>
  );
}

// Header component with game metadata
function GameCardHeader({ className }: { className?: string }) {
  const { game } = useGameCard();

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-AU", {
      hour: "numeric",
      minute: "numeric",
    });
  };

  return (
    <div className={cn("px-2 py-2 bg-gray-100", className)}>
      <div className="flex items-center justify-between text-xs text-gray-600 gap-5">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatTime(game.date)}</span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span>
            <span>{game.venue.name}</span>
            <span>, {game.venue.city}</span>
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
  const { game, prediction, predictionLoading, tip, onTipSelect } = useGameCard();
  const isGameStarted = useGameStartTimer(game.unixTime);
  const isComplete = AflGame.isComplete(game);
  const isLocked = isGameStarted || isComplete;

  const isSelected = tip?.tipTeamId === team.id;
  const tippedCorrectly = isComplete && isSelected && game.winnerTeamId === team.id;
  const tippedIncorrectly = isComplete && isSelected && game.winnerTeamId !== team.id;

  const confidence = isAwayTeam
    ? (prediction?.awayConfidence ?? 0)
    : (prediction?.homeConfidence ?? 0);
  const showLoading = !isGameStarted && predictionLoading;
  const displayValue = isGameStarted
    ? isAwayTeam
      ? game.awayScore
      : game.homeScore
    : `${Math.round(confidence)}%`;
  const confidenceLabel =
    !isGameStarted && prediction ? (confidence >= 50 ? "Favourite" : "Underdog") : null;

  return (
    <Button
      className={cn(
        "flex-1 text-black h-auto p-2 min-w-0 flex flex-row justify-between rounded-none transition-all min-h-20 sm:min-h-22.5 bg-transparent shadow-none",
        isLocked
          ? "hover:bg-transparent cursor-default"
          : "hover:bg-inherit sm:hover:bg-blue-200 hover:cursor-pointer",
        isAwayTeam && "flex-row-reverse",
        tippedCorrectly &&
          (isAwayTeam
            ? "shadow-[inset_-20px_0_28px_-6px_rgba(34,197,94,0.3)]"
            : "shadow-[inset_20px_0_28px_-6px_rgba(34,197,94,0.3)]"),
        tippedIncorrectly &&
          (isAwayTeam
            ? "shadow-[inset_-20px_0_28px_-6px_rgba(239,68,68,0.3)]"
            : "shadow-[inset_20px_0_28px_-6px_rgba(239,68,68,0.3)]"),
        !isComplete &&
          isSelected &&
          !tippedCorrectly &&
          !tippedIncorrectly &&
          (isAwayTeam
            ? "shadow-[inset_-20px_0_28px_-6px_rgba(59,130,246,0.3)]"
            : "shadow-[inset_20px_0_28px_-6px_rgba(59,130,246,0.3)]"),
        className,
      )}
      onClick={() => !isLocked && onTipSelect(game.id, team.id)}
      disabled={false}
    >
      {tippedCorrectly ? (
        <div className="flex w-4 h-4 rounded-full items-center justify-center bg-green-500">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      ) : tippedIncorrectly ? (
        <div className="flex w-4 h-4 rounded-full items-center justify-center bg-red-500">
          <X className="w-3 h-3 text-white" strokeWidth={3} />
        </div>
      ) : isLocked && isSelected ? (
        <div className="flex w-4 h-4 items-center justify-center text-blue-500">
          <Lock className="w-3.5 h-3.5" />
        </div>
      ) : isLocked ? (
        <div className="w-4 h-4" />
      ) : (
        <div
          className={cn(
            "aspect-square flex sm:flex w-4 h-4 rounded-full border-2 items-center justify-center",
            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300",
          )}
        >
          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
          <img src={team.logo} alt={`${team.name} logo`} />
        </div>
        <span className="hidden sm:inline-block text-xs sm:text-sm font-medium text-center leading-tight px-1 text-wrap">
          {team.name}
        </span>
      </div>

      <div className="sm:hidden flex flex-col items-center">
        {showLoading ? (
          <img src={logo} alt="Loading" className="w-6 h-6 animate-spin" />
        ) : (
          <>
            <div className="font-semibold text-lg">{displayValue}</div>
            {confidenceLabel && <div className="text-[10px] text-gray-500">{confidenceLabel}</div>}
          </>
        )}
      </div>
      <div className="hidden sm:flex flex-col items-center">
        {showLoading ? (
          <img src={logo} alt="Loading" className="w-8 h-8 animate-spin" />
        ) : (
          <>
            <div className="font-semibold text-2xl">{displayValue}</div>
            {confidenceLabel && <div className="text-xs text-gray-500">{confidenceLabel}</div>}
          </>
        )}
      </div>
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

// Margin input for the first game of the round
function GameCardMarginInput() {
  const { game, homeTeam, awayTeam, tip, isMarginGame, margin, onMarginChange } = useGameCard();
  const isGameStarted = useGameStartTimer(game.unixTime);
  if (!isMarginGame || !tip || !onMarginChange) return null;

  const tippedTeam = tip.tipTeamId === homeTeam.id ? homeTeam : awayTeam;

  if (isGameStarted) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border-t">
        <span className="text-xs font-medium text-gray-600">{tippedTeam.abbrev} by</span>
        <span className="text-sm font-semibold">{margin ?? 0}</span>
        <span className="text-xs text-gray-500">pts</span>
      </div>
    );
  }

  const handleChange = (value: string) => {
    const num = parseInt(value, 10);
    if (value === "" || isNaN(num)) {
      onMarginChange(undefined);
    } else {
      onMarginChange(Math.min(200, Math.max(0, num)));
    }
  };

  const handleStep = (delta: number) => {
    const current = margin ?? 0;
    const next = Math.min(200, Math.max(0, current + delta));
    onMarginChange(next);
  };

  const atMin = margin === undefined || margin <= 0;
  const atMax = margin !== undefined && margin >= 200;

  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 border-t">
      <span className="text-xs font-medium text-gray-600">{tippedTeam.abbrev} by</span>
      <div className="flex items-center">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-r-none border-r-0"
          onClick={() => handleStep(-1)}
          disabled={atMin}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <input
          type="number"
          min={0}
          max={200}
          value={margin ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="0"
          className="w-14 h-7 text-center text-sm font-semibold border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 focus:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-l-none border-l-0"
          onClick={() => handleStep(1)}
          disabled={atMax}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <span className="text-xs text-gray-500">pts</span>
    </div>
  );
}

// Last 5 result indicators with round numbers, innermost = most recent
function Last5Indicators({
  results,
  align,
}: {
  results: { round: number; result: "win" | "loss" | "draw" | "bye" }[];
  align: "left" | "right";
}) {
  const ordered = align === "left" ? results : [...results].reverse();

  return (
    <div className="text-xs flex flex-row items-center gap-1">
      {ordered.map((entry) => (
        <div key={entry.round} className="flex flex-col items-center gap-0.5">
          <div
            className={cn(
              "flex items-center justify-center w-4 h-4 rounded",
              entry.result === "win" && "bg-green-500",
              entry.result === "loss" && "bg-red-500",
              entry.result === "draw" && "bg-amber-400",
              entry.result === "bye" && "bg-gray-300",
            )}
          >
            {entry.result === "win" && <span className="text-[10px] font-bold text-white">W</span>}
            {entry.result === "loss" && <span className="text-[10px] font-bold text-white">L</span>}
            {entry.result === "draw" && <span className="text-[10px] font-bold text-white">D</span>}
          </div>
          <span className="text-[9px] text-gray-400">{entry.round}</span>
        </div>
      ))}
    </div>
  );
}

// Stats section component
function GameCardStats({ className, enabled = false }: { className?: string; enabled?: boolean }) {
  const { game, homeTeam, awayTeam } = useGameCard();
  const { data: stats, isLoading } = useQuery({
    ...aflQueries.gameStats(game.id),
    enabled,
  });

  if (isLoading || !stats) {
    return (
      <div className={cn("p-2 bg-gray-50 border-t", className)}>
        <div className="flex flex-col gap-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
        </div>
      </div>
    );
  }

  const h2hSummary =
    stats.h2h.total === 0
      ? "No H2H this season"
      : stats.h2h.homeWins === stats.h2h.awayWins
        ? `${stats.h2h.homeWins}-${stats.h2h.awayWins} drawn`
        : stats.h2h.homeWins > stats.h2h.awayWins
          ? `${homeTeam.name} leads ${stats.h2h.homeWins}-${stats.h2h.awayWins}`
          : `${awayTeam.name} leads ${stats.h2h.awayWins}-${stats.h2h.homeWins}`;

  return (
    <div className={cn("p-2 bg-gray-50 border-t", className)}>
      <div className="text-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-row justify-around gap-2 items-center sm:hidden">
            <div className="text-sm font-semibold">{homeTeam.name}</div>
            <div className="font-medium">VS</div>
            <div className="text-sm font-semibold">{awayTeam.name}</div>
          </div>

          {stats.homeLast5.length > 0 ? (
            <div className="flex flex-row justify-around gap-2 items-center">
              <Last5Indicators results={stats.homeLast5} align="left" />
              <div className="font-medium">Last 5 Games</div>
              <Last5Indicators results={stats.awayLast5} align="right" />
            </div>
          ) : (
            <div className="text-center text-xs text-muted-foreground">
              No prior games this season
            </div>
          )}

          <div className="flex flex-row justify-around gap-2 items-center">
            <div className="text-xs">{stats.h2h.homeWins}W</div>
            <div className="flex flex-col items-center justify-center">
              <div className="font-medium">H2H</div>
              <div className="text-xs">{h2hSummary}</div>
            </div>
            <div className="text-xs">{stats.h2h.awayWins}W</div>
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
  predictionLoading?: boolean;
  isMarginGame?: boolean;
  margin?: number;
  onMarginChange?: (margin: number | undefined) => void;
  onTipSelect: (gameId: number, teamId: number) => void;
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  prediction,
  predictionLoading,
  tip,
  isMarginGame,
  margin,
  onMarginChange,
  onTipSelect,
}: GameCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <GameCardRoot
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      prediction={prediction}
      predictionLoading={predictionLoading}
      tip={tip}
      isMarginGame={isMarginGame}
      margin={margin}
      onMarginChange={onMarginChange}
      onTipSelect={onTipSelect}
    >
      <Accordion type="single" collapsible onValueChange={(value) => setIsOpen(value === "item-1")}>
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
          <GameCardMarginInput />
          <AccordionContent>
            <GameCardStats enabled={isOpen} />
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
  predictionLoading,
  tip,
  onTipSelect,
}: GameCardProps) {
  return (
    <GameCardRoot
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      prediction={prediction}
      predictionLoading={predictionLoading}
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
