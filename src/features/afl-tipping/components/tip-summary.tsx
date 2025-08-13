"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Trash2, CheckCircle } from "lucide-react";
import { Game } from "~/features/afl-tipping/afl-data";

interface TipSummaryProps {
  games: Game[];
  tips: Record<string, string>;
  roundName: string;
  onClearTips: () => void;
}

export function TipSummary({
  games,
  tips,
  roundName,
  onClearTips,
}: TipSummaryProps) {
  const totalGames = games.length;
  const tipsMade = Object.keys(tips).length;
  const progressPercentage = totalGames > 0 ? (tipsMade / totalGames) * 100 : 0;

  if (totalGames === 0) return null;

  return (
    <Card className="mb-4 sm:mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg sm:text-xl">Tip Summary</CardTitle>
          {tipsMade > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearTips}
              className="text-destructive hover:text-destructive bg-transparent"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {tipsMade} of {totalGames} games
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {tipsMade === totalGames ? (
            <Badge
              variant="default"
              className="bg-green-500 hover:bg-green-600"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          ) : tipsMade > 0 ? (
            <Badge variant="secondary">In Progress</Badge>
          ) : (
            <Badge variant="outline">Not Started</Badge>
          )}

          {tipsMade === totalGames && (
            <span className="text-sm text-muted-foreground">
              All tips submitted for {roundName}
            </span>
          )}
        </div>

        {/* Quick Stats */}
        {tipsMade > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold">{tipsMade}</div>
              <div className="text-xs text-muted-foreground">Tips Made</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {totalGames - tipsMade}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
