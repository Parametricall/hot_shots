import { Card, CardContent } from "~/components/ui/card";
import React, {
  ComponentProps,
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertTriangle, Check, Clock, Lock, MapPin, Minus, Plus, X } from "lucide-react";
import type { AflModelTip, AflTeam, AflUserTip } from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { cn } from "~/lib/utils";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import { formatTime, getTipSnapshotMismatch } from "~/features/afl-tipping/utils/afl-tipping";
import { useGameStartTimer } from "~/features/afl-tipping/hooks/use-game-start-timer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useTipMutation } from "~/features/afl-tipping/hooks/use-tip-mutation";

// Context for sharing game data across composed components
interface GameCardContextValue {
  game: AflGame.Type;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  predictionLoading?: boolean;
  showMargin?: boolean;
  submitTip: (gameId: number, teamId: number, margin?: number) => void;
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
  game: AflGame.Type;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  predictionLoading?: boolean;
  showMargin?: boolean;
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
  showMargin,
  className,
}: GameCardRootProps) {
  const mutation = useTipMutation();
  const submitTip = useCallback(
    (gameId: number, teamId: number, margin?: number) => {
      mutation.mutate({ data: { gameId, teamId, margin } });
    },
    [mutation],
  );

  return (
    <GameCardContext.Provider
      value={{
        game,
        homeTeam,
        awayTeam,
        tip,
        prediction,
        predictionLoading,
        showMargin,
        submitTip,
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

function TipStateIndicator({
  isSelected,
  isLocked,
  tippedCorrectly,
  tippedIncorrectly,
}: {
  isSelected: boolean;
  isLocked: boolean;
  tippedCorrectly: boolean;
  tippedIncorrectly: boolean;
}) {
  if (tippedCorrectly) {
    return (
      <div className="flex w-4 h-4 rounded-full items-center justify-center bg-green-500">
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (tippedIncorrectly) {
    return (
      <div className="flex w-4 h-4 rounded-full items-center justify-center bg-red-500">
        <X className="w-3 h-3 text-white" strokeWidth={3} />
      </div>
    );
  }
  if (isLocked && isSelected) {
    return (
      <div className="flex w-4 h-4 items-center justify-center text-blue-500">
        <Lock className="w-3.5 h-3.5" />
      </div>
    );
  }
  if (isLocked) {
    return <div className="w-4 h-4" />;
  }
  return (
    <div
      className={cn(
        "aspect-square flex sm:flex w-4 h-4 rounded-full border-2 items-center justify-center",
        isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300",
      )}
    >
      {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
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
  const { game, prediction, predictionLoading, tip, showMargin, submitTip } = useGameCard();
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
      onClick={() => !isLocked && submitTip(game.id, team.id, showMargin ? tip?.margin : undefined)}
      disabled={false}
    >
      <TipStateIndicator
        isSelected={isSelected}
        isLocked={isLocked}
        tippedCorrectly={tippedCorrectly}
        tippedIncorrectly={tippedIncorrectly}
      />

      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
          <img src={team.logo} alt={`${team.name} logo`} />
        </div>
        <span className="hidden sm:inline-block text-xs sm:text-sm font-medium text-center leading-tight px-1 text-wrap">
          {team.name}
        </span>
      </div>

      <div className="sm:hidden flex flex-col items-center gap-1">
        {showLoading ? (
          <>
            <Skeleton className="h-6 w-10" aria-label="Loading prediction" />
            <Skeleton className="h-2.5 w-14" />
          </>
        ) : (
          <>
            <div className="font-semibold text-lg">{displayValue}</div>
            {confidenceLabel && <div className="text-[10px] text-gray-500">{confidenceLabel}</div>}
          </>
        )}
      </div>
      <div className="hidden sm:flex flex-col items-center gap-1">
        {showLoading ? (
          <>
            <Skeleton className="h-8 w-14" aria-label="Loading prediction" />
            <Skeleton className="h-3 w-16" />
          </>
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

// Shown when the underdog snapshot stored with the tip disagrees with the live
// model tip, so the card's live "Favourite"/"Underdog" labels don't match what
// the tip actually counts as. Sits under the matchup row rather than inside the
// team button because the per-team value column is only ~60px wide on mobile.
function GameCardTipStatusNotice() {
  const { game, homeTeam, awayTeam, tip, prediction } = useGameCard();
  const isGameStarted = useGameStartTimer(game.unixTime);
  const isLocked = isGameStarted || AflGame.isComplete(game);

  const status = getTipSnapshotMismatch(tip, prediction);
  const tippedTeam =
    tip?.tipTeamId === homeTeam.id ? homeTeam : tip?.tipTeamId === awayTeam.id ? awayTeam : null;

  if (!status || !tippedTeam) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-3 py-1.5 border-t border-amber-200 bg-amber-50 text-[11px] leading-tight text-amber-800">
      <span className="flex items-center gap-1 font-medium">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Your {tippedTeam.name} tip counts as {status === "underdog" ? "an Underdog" : "a Favourite"}
      </span>
      {!isLocked && <span className="text-amber-700">Tap {tippedTeam.name} again to update</span>}
    </div>
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
      <GameCardTipStatusNotice />
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
  const { game, homeTeam, awayTeam, tip, showMargin, submitTip } = useGameCard();
  const isGameStarted = useGameStartTimer(game.unixTime);

  // Own margin state, synced from server tip
  const [margin, setMargin] = useState<number | undefined>(tip?.margin);
  const [lastSyncedMargin, setLastSyncedMargin] = useState<number | undefined>(tip?.margin);
  if (tip?.margin !== lastSyncedMargin) {
    setLastSyncedMargin(tip?.margin);
    setMargin(tip?.margin);
  }

  // Debounced save
  const marginTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (marginTimerRef.current) clearTimeout(marginTimerRef.current);
    };
  }, []);

  const saveMargin = useCallback(
    (marginValue: number | undefined) => {
      if (!tip) return;
      submitTip(game.id, tip.tipTeamId, marginValue);
    },
    [game.id, tip, submitTip],
  );

  const handleMarginChange = useCallback(
    (newMargin: number | undefined) => {
      setMargin(newMargin);
      if (marginTimerRef.current) clearTimeout(marginTimerRef.current);
      marginTimerRef.current = setTimeout(() => saveMargin(newMargin), 500);
    },
    [saveMargin],
  );

  if (!showMargin || !tip) return null;

  const tippedTeam = tip.tipTeamId === homeTeam.id ? homeTeam : awayTeam;

  const isComplete = AflGame.isComplete(game);

  if (isComplete) {
    const actualMargin = GameRules.getActualMargin(game);
    const tippedTeamWon = game.winnerTeamId === tip.tipTeamId;
    const tipMargin = margin ?? 0;
    const marginDiff =
      actualMargin != null
        ? GameRules.calculateMarginDiff(tipMargin, actualMargin, tippedTeamWon)
        : null;

    return (
      <div className="flex items-center justify-center gap-3 px-3 py-2 bg-gray-50 border-t text-xs">
        <span className="text-gray-500">
          Margin: <span className="font-semibold text-gray-700">{actualMargin}</span> pts
        </span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">
          Prediction: <span className="font-semibold text-gray-700">{tipMargin}</span> pts
        </span>
        {marginDiff != null && (
          <>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-gray-700">+{marginDiff} to total</span>
          </>
        )}
      </div>
    );
  }

  if (isGameStarted) {
    const liveMargin =
      game.homeScore != null && game.awayScore != null
        ? Math.abs(game.homeScore - game.awayScore)
        : null;
    const tipMargin = margin ?? 0;

    return (
      <div className="flex items-center justify-center gap-3 px-3 py-2 bg-gray-50 border-t text-xs">
        <span className="text-gray-500">
          Margin: <span className="font-semibold text-gray-700">{liveMargin ?? "—"}</span> pts
        </span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">
          Prediction: <span className="font-semibold text-gray-700">{tipMargin}</span> pts
        </span>
      </div>
    );
  }

  const handleChange = (value: string) => {
    const num = parseInt(value, 10);
    if (value === "" || isNaN(num)) {
      handleMarginChange(undefined);
    } else {
      handleMarginChange(Math.min(200, Math.max(0, num)));
    }
  };

  const handleStep = (delta: number) => {
    const current = margin ?? 0;
    const next = Math.min(200, Math.max(0, current + delta));
    handleMarginChange(next);
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
  game: AflGame.Type;
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  tip?: AflUserTip;
  prediction?: AflModelTip;
  predictionLoading?: boolean;
  showMargin?: boolean;
}

export function GameCard({
  game,
  homeTeam,
  awayTeam,
  prediction,
  predictionLoading,
  tip,
  showMargin,
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
      showMargin={showMargin}
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
}: GameCardProps) {
  return (
    <GameCardRoot
      game={game}
      homeTeam={homeTeam}
      awayTeam={awayTeam}
      prediction={prediction}
      predictionLoading={predictionLoading}
      tip={tip}
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

// Placeholder for games where teams haven't been allocated yet (e.g. finals)
export function GameCardTBD({ game }: { game: AflGame.Type }) {
  return (
    <Card className="p-0 overflow-hidden rounded-lg opacity-60">
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
                <span>{game.venue.name}</span>
                {game.venue.city && <span>, {game.venue.city}</span>}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-6 sm:py-8 text-sm sm:text-base text-muted-foreground font-medium">
          TBD vs TBD
        </div>
      </CardContent>
    </Card>
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
