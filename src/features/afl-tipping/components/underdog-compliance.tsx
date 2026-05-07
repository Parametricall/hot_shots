import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import type { AflUnderdogComplianceEntry } from "~/features/afl-tipping/types";

function ComplianceSkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

function ComplianceSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <ComplianceSkeletonRow key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

interface ComplianceRowProps {
  entry: AflUnderdogComplianceEntry;
  roundIndex: number;
  isCurrentUser: boolean;
}

function ComplianceRow({ entry, roundIndex, isCurrentUser }: ComplianceRowProps) {
  const roundData = entry.rounds[roundIndex];
  if (!roundData) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 border-b last:border-b-0",
        isCurrentUser && "bg-blue-50 border-blue-200",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{entry.displayName}</span>
          {isCurrentUser && (
            <Badge variant="secondary" className="text-xs">
              You
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <div className="text-center">
          <div className="font-semibold">{roundData.underdogCount}</div>
          <div className="text-xs text-muted-foreground">Underdogs</div>
        </div>
        <div className="w-20 flex justify-center">
          {roundData.isFinals ? (
            <span className="text-xs text-muted-foreground">N/A</span>
          ) : roundData.meetsMinimum ? (
            <div className="flex items-center gap-1 text-green-600">
              <Check className="h-4 w-4" />
              <span className="text-xs">Met</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">Not met</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UnderdogCompliance() {
  const {
    data: compliance,
    isLoading,
    isError,
    refetch,
  } = useQuery(aflQueries.underdogCompliance());
  const { user } = useUser();

  const { data: games } = useQuery(aflQueries.allGames());
  const activeRound = useMemo(() => (games ? AflGame.getActiveRound(games) : 0), [games]);

  const availableRounds = compliance?.[0]?.rounds ?? [];
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);

  // Default to the current active round, falling back to the last available round
  const defaultRoundIndex = useMemo(() => {
    const idx = availableRounds.findIndex((r) => r.round === activeRound);
    return idx !== -1 ? idx : Math.max(0, availableRounds.length - 1);
  }, [availableRounds, activeRound]);

  const roundIndex = selectedRoundIndex ?? defaultRoundIndex;

  if (isLoading) return <ComplianceSkeleton />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p>Failed to load underdog compliance. Please try again later.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!compliance || availableRounds.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No underdog tracking data yet. Data is recorded when tips are submitted.
        </CardContent>
      </Card>
    );
  }

  const currentRoundData = availableRounds[roundIndex];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Underdog Rule
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRoundIndex(Math.max(0, roundIndex - 1))}
              disabled={roundIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[70px] text-center">
              Round {currentRoundData?.round}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelectedRoundIndex(Math.min(availableRounds.length - 1, roundIndex + 1))
              }
              disabled={roundIndex === availableRounds.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {currentRoundData?.isFinals
            ? "Finals round - underdog rule does not apply."
            : `Minimum ${GameRules.MINIMUM_UNDERDOGS_PER_ROUND} underdog tips required per round.`}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {compliance.map((entry) => (
          <ComplianceRow
            key={entry.userId}
            entry={entry}
            roundIndex={roundIndex}
            isCurrentUser={entry.userId === user?.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}
