import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLocalStorage } from "~/hooks/use-local-storage";
import {
  generateRoundNames,
  generateSampleFixtures,
} from "~/features/afl-tipping/afl-data";
import { RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { RoundNavigation } from "~/features/afl-tipping/components/round-navigation";
import { TipSummary } from "~/features/afl-tipping/components/tip-summary";
import { GamesList } from "~/features/afl-tipping/components/games-list";

export const Route = createFileRoute("/afl-tipping")({
  component: RouteComponent,
});

function RouteComponent() {
  const [currentRound, setCurrentRound] = useState(0);
  const [tips, setTips] = useLocalStorage<
    Record<string, Record<string, string>>
  >("afl-tips-2024", {});

  const rounds = generateSampleFixtures();
  const roundNames = generateRoundNames();
  const currentRoundData = rounds[currentRound];

  const handleTipSelect = (gameId: string, teamId: string) => {
    setTips((prev) => {
      const newTips = { ...prev };

      // Handle clearing tips when empty string is passed
      if (teamId === "") {
        if (newTips[currentRound]) {
          delete newTips[currentRound][gameId];
          // Remove round entry if no tips left
          if (Object.keys(newTips[currentRound]).length === 0) {
            delete newTips[currentRound];
          }
        }
      } else {
        newTips[currentRound] = {
          ...newTips[currentRound],
          [gameId]: teamId,
        };
      }

      return newTips;
    });
  };

  const handleClearRoundTips = () => {
    setTips((prev) => {
      const newTips = { ...prev };
      delete newTips[currentRound];
      return newTips;
    });
  };

  const handleResetAllTips = () => {
    setTips({});
  };

  const currentRoundTips = tips[currentRound] || {};

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <header className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                AFL Tipping
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Make your tips for the 2024 season
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAllTips}
              className="text-muted-foreground hover:text-foreground bg-transparent"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Reset All</span>
            </Button>
          </div>
        </header>

        <RoundNavigation
          currentRound={currentRound}
          onRoundChange={setCurrentRound}
        />

        {currentRoundData && (
          <TipSummary
            games={currentRoundData.games}
            tips={currentRoundTips}
            roundName={roundNames[currentRound]}
            onClearTips={handleClearRoundTips}
          />
        )}

        {currentRoundData && (
          <GamesList
            games={currentRoundData.games}
            roundName={roundNames[currentRound]}
            tips={currentRoundTips}
            onTipSelect={handleTipSelect}
          />
        )}
      </div>
    </div>
  );
}
