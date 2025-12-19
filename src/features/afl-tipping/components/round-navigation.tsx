"use client";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { aflGamesToRounds } from "~/features/afl-tipping/utils";
import { Dispatch, SetStateAction } from "react";

interface RoundNavigationProps {
  currentRound: number | undefined;
  onRoundChange: Dispatch<SetStateAction<number>>;
}

export function RoundNavigation({
  currentRound,
  onRoundChange,
}: RoundNavigationProps) {
  const { data: rounds } = useQuery({
    ...aflQueries.allGames(),
    select: aflGamesToRounds,
  });

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

  if (!rounds || !currentRound) return <div>Loading rounds</div>;

  return (
    <Card className="mb-4 sm:mb-6">
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

          <div className="text-center flex-1 px-2">
            <h2 className="font-semibold text-base sm:text-lg">
              {rounds?.[currentRound]?.name ?? "no round"}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {currentRound + 1} of {rounds.length}
            </p>
          </div>

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
            <h2 className="text-xl font-semibold">Select Round</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentRound === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
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
              const isActive = index === currentRound;
              const isFinal = index >= 25;

              return (
                <Button
                  key={index}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onRoundChange(index)}
                  className={`text-xs px-2 py-1 h-auto min-h-[32px] ${
                    isFinal
                      ? "bg-orange-50 border-orange-200 hover:bg-orange-100"
                      : ""
                  } ${isActive && isFinal ? "bg-orange-500 hover:bg-orange-600" : ""}`}
                >
                  {index === 0
                    ? "Opening"
                    : index <= 24
                      ? `R${index}`
                      : round.name.split(" ")[0]}
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
