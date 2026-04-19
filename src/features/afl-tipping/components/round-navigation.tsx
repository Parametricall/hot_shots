import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AflRound } from "~/features/afl-tipping/types";
import { REGULAR_SEASON_ROUNDS } from "~/features/afl-tipping/constants";
import { cn } from "~/lib/utils";

interface RoundNavigationProps {
  currentRound: number;
  activeRound?: number;
  onRoundChange: (round: number | undefined) => void;
  rounds: AflRound[];
}

export function RoundNavigation({
  currentRound,
  activeRound,
  onRoundChange,
  rounds,
}: RoundNavigationProps) {
  const handlePrevious = () => {
    if (currentRound > 0) {
      onRoundChange(currentRound - 1);
    }
  };

  const handleNext = () => {
    if (currentRound < rounds.length - 1) {
      onRoundChange(currentRound + 1);
    }
  };

  return (
    <Card className="mb-2 sm:mb-4 py-2">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between md:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentRound === 0}
            className="flex items-center gap-1 bg-transparent min-w-[70px] h-9"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>

          <label className="text-center flex-1 px-2 cursor-pointer relative">
            <select
              value={currentRound}
              onChange={(e) => onRoundChange(Number(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              {rounds.map((round, index) => (
                <option key={index} value={index}>
                  {round.name}
                  {index === activeRound ? " (Current)" : ""}
                </option>
              ))}
            </select>
            <h2 className="font-semibold text-base sm:text-lg">
              {rounds?.[currentRound]?.name ?? "no round"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground inline-flex items-center gap-1">
              {currentRound + 1} of {rounds.length}
              {currentRound === activeRound && (
                <span className="ml-1 text-blue-500 font-medium">· Current</span>
              )}
              <ChevronDown className="h-3 w-3" />
            </p>
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentRound === rounds.length - 1}
            className="flex items-center gap-1 bg-transparent min-w-[70px] h-9"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{rounds?.[currentRound]?.name ?? "no round"}</h2>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Prev"
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentRound === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Next"
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentRound === rounds.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {rounds.map((round, index) => {
              const isSelected = index === currentRound;
              const isUpcoming = index === activeRound;
              const isFinal = index >= REGULAR_SEASON_ROUNDS;

              return (
                <Button
                  key={index}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onRoundChange(index)}
                  className={cn(
                    "relative text-xs px-2 py-1 h-auto min-h-[32px]",
                    isFinal && "bg-orange-50 border-orange-200 hover:bg-orange-100",
                    isSelected && isFinal && "bg-orange-500 hover:bg-orange-600",
                    !isSelected && isUpcoming && "ring-2 ring-blue-400",
                  )}
                >
                  {index === 0
                    ? "Opening"
                    : index < REGULAR_SEASON_ROUNDS
                      ? `R${index}`
                      : round.name.split(" ")[0]}
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
