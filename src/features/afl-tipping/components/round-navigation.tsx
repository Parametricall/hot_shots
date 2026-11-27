import { useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AflRound } from "~/features/afl-tipping/types";
import { REGULAR_SEASON_ROUNDS } from "~/features/afl-tipping/constants";
import type { RoundDotStatus } from "~/features/afl-tipping/utils/round-status";
import { cn } from "~/lib/utils";

export type RoundNavigationProps = {
  /** The selected Round's number (its `id`), not its place in `rounds`. */
  currentRound: number;
  /** The Current Round's number. */
  activeRound?: number;
  /** Called with the number of the Round picked. */
  onRoundChange: (round: number | undefined) => void;
  /** The Season's Rounds in order. A Season may start at Round 0 (Opening Round) or Round 1. */
  rounds: AflRound[];
  /** Each Round's tipping status, in the order of `rounds`, for the chips' dots. */
  statuses?: (RoundDotStatus | undefined)[];
};

/** "Opening", "R1" to "R24", and a Finals Round's first word ("Qualifying", "Grand"). */
function chipLabel(round: AflRound): string {
  if (round.id === 0) return "Opening";
  if (!isFinalsRound(round)) return `R${round.id}`;
  return round.name.split(" ")[0] ?? round.name;
}

function isFinalsRound(round: AflRound): boolean {
  return round.id >= REGULAR_SEASON_ROUNDS;
}

const DOT_LABELS: Record<RoundDotStatus, string> = {
  tipped: "all tipped",
  untipped: "some games untipped",
  closed: "locked",
};

const DOT_CLASSES: Record<RoundDotStatus, string> = {
  tipped: "bg-green-500",
  untipped: "bg-amber-500",
  closed: "bg-muted-foreground/50",
};

/**
 * Round navigation. A phone gets a strip of chips that scrolls sideways, snapping, with the
 * selected Round kept in the middle; desktop gets a grid of buttons with Prev and Next. Finals are
 * orange and the Current Round is ringed in both. On the phone each chip also has a dot: green when
 * every Game still open has a Tip, amber when one hasn't, grey once the Round is locked or done.
 *
 * Rounds are known by their number, never their place in the list: 2026 opened with Round 0, 2027
 * starts at Round 1, so the first chip is whichever Round the Season has first.
 */
export function RoundNavigation({
  currentRound,
  activeRound,
  onRoundChange,
  rounds,
  statuses,
}: RoundNavigationProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const isFirstScroll = useRef(true);

  // Keep the selected chip in the middle of the strip: at once on mount, smoothly after.
  useEffect(() => {
    const strip = stripRef.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !chip) return;
    const left = chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2;
    if (typeof strip.scrollTo === "function") {
      strip.scrollTo({ left, behavior: isFirstScroll.current ? "instant" : "smooth" });
    } else {
      strip.scrollLeft = left;
    }
    isFirstScroll.current = false;
  }, [currentRound]);

  const position = rounds.findIndex((round) => round.id === currentRound);
  const previousRound = position > 0 ? rounds[position - 1] : undefined;
  const nextRound = position >= 0 ? rounds[position + 1] : undefined;

  const handlePrevious = () => {
    if (previousRound) onRoundChange(previousRound.id);
  };

  const handleNext = () => {
    if (nextRound) onRoundChange(nextRound.id);
  };

  return (
    <Card className="py-0 max-md:border-0 max-md:bg-transparent max-md:shadow-none">
      <CardContent className="p-0 md:p-4">
        <div
          ref={stripRef}
          className="relative -mx-2 flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-2 py-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
        >
          {rounds.map((round, index) => {
            const isSelected = round.id === currentRound;
            const isCurrent = round.id === activeRound;
            const isFinal = isFinalsRound(round);
            const status = statuses?.[index];
            return (
              <button
                key={round.id}
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onRoundChange(round.id)}
                className={cn(
                  "relative flex h-10 min-w-12 shrink-0 snap-center items-center justify-center gap-1 rounded-full border px-3 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  isFinal ? "border-orange-200 bg-orange-50" : "bg-background",
                  isSelected &&
                    (isFinal
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-primary bg-primary text-primary-foreground"),
                  !isSelected && isCurrent && "ring-2 ring-blue-400",
                )}
              >
                <span aria-hidden>{chipLabel(round)}</span>
                <span className="sr-only">
                  {round.name}
                  {isCurrent ? ", current" : ""}
                  {status ? `, ${DOT_LABELS[status]}` : ""}
                </span>
                {status && (
                  <span
                    aria-hidden
                    data-status={status}
                    className={cn(
                      "size-2 rounded-full",
                      DOT_CLASSES[status],
                      isSelected && "ring-1 ring-white/80",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{rounds[position]?.name ?? "no round"}</h2>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Prev"
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={!previousRound}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Next"
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={!nextRound}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {rounds.map((round) => {
              const isSelected = round.id === currentRound;
              const isUpcoming = round.id === activeRound;
              const isFinal = isFinalsRound(round);

              return (
                <Button
                  key={round.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onRoundChange(round.id)}
                  className={cn(
                    "relative text-xs px-2 py-1 h-auto min-h-[32px]",
                    isFinal && "bg-orange-50 border-orange-200 hover:bg-orange-100",
                    isSelected && isFinal && "bg-orange-500 hover:bg-orange-600",
                    !isSelected && isUpcoming && "ring-2 ring-blue-400",
                  )}
                >
                  {chipLabel(round)}
                  {isUpcoming && !isSelected && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                  )}
                </Button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 border border-border rounded"></div>
              <span>Regular Season</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-200 border border-orange-300 rounded"></div>
              <span>Finals</span>
            </div>
            {activeRound !== undefined && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 ring-2 ring-blue-400 rounded"></div>
                <span>Current</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
