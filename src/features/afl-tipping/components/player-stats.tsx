import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "~/features/auth/use-current-user";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/features/afl-tipping/components/segmented-control";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import type { AflPlayerRoundStats, AflPlayerStatsEntry } from "~/features/afl-tipping/types";

type StatsView = "round" | "season";

const VIEW_OPTIONS = [
  { value: "round", label: "By Round" },
  { value: "season", label: "Season" },
] as const satisfies readonly { value: StatsView; label: string }[];

function StatBlock({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="text-center w-12">
      <div className="font-semibold text-sm">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function UnderdogStatus({ roundStats }: { roundStats: AflPlayerRoundStats }) {
  if (roundStats.isFinals) {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        roundStats.meetsMinimum ? "text-green-600" : "text-amber-600",
      )}
    >
      {roundStats.underdogCount}
      {roundStats.meetsMinimum ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

function CorrectTipStatus({ roundStats }: { roundStats: AflPlayerRoundStats }) {
  return (
    <span className={cn("inline-flex items-center gap-1")}>
      <Star
        className={cn(
          "h-3.5 w-3.5 text-yellow-600 fill-yellow-400",
          roundStats.correctTips !== roundStats.totalGames && "invisible",
        )}
      />
      {roundStats.correctTips}/{roundStats.totalGames}
    </span>
  );
}

function formatAccuracy(accuracy: number | null) {
  return accuracy === null ? "—" : `${Math.round(accuracy)}%`;
}

interface PlayerStatsRowProps {
  entry: AflPlayerStatsEntry;
  view: StatsView;
  roundIndex: number;
  isCurrentUser: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function PlayerStatsRow({
  entry,
  view,
  roundIndex,
  isCurrentUser,
  isExpanded,
  onToggle,
}: PlayerStatsRowProps) {
  const roundStats = entry.rounds[roundIndex];
  if (view === "round" && !roundStats) return null;

  return (
    <div className={cn("border-b last:border-b-0", isCurrentUser && "bg-blue-50 border-blue-200")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180",
          )}
        />

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

        {view === "round" && roundStats ? (
          <div className="flex items-center gap-2 text-sm">
            <StatBlock value={<CorrectTipStatus roundStats={roundStats} />} label="Correct" />
            <StatBlock
              value={roundStats.marginDiff == null ? "—" : `+${roundStats.marginDiff}`}
              label="Margin"
            />
            <StatBlock value={<UnderdogStatus roundStats={roundStats} />} label="Dogs" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <StatBlock
              value={`${entry.season.correctTips}/${entry.season.gamesCompleted}`}
              label="Correct"
            />
            <StatBlock value={formatAccuracy(entry.season.accuracy)} label="Acc" />
            <StatBlock value={entry.season.longestStreak} label="Streak" />
          </div>
        )}
      </button>

      {isExpanded && <PlayerRoundBreakdown entry={entry} />}
    </div>
  );
}

function PlayerRoundBreakdown({ entry }: { entry: AflPlayerStatsEntry }) {
  return (
    <div className="px-4 pb-3 pl-11">
      <div className="grid grid-cols-4 gap-x-2 text-xs text-muted-foreground pb-1 border-b">
        <span>Round</span>
        <span className="text-center">Correct</span>
        <span className="text-center">Margin</span>
        <span className="text-center">Dogs</span>
      </div>
      {entry.rounds.map((roundStats) => (
        <div
          key={roundStats.round}
          className="grid grid-cols-4 gap-x-2 text-xs py-1 border-b border-dashed last:border-b-0"
        >
          <span>
            R{roundStats.round}
            {roundStats.isFinals && <span className="text-muted-foreground"> (F)</span>}
          </span>
          <span className="text-center">
            <CorrectTipStatus roundStats={roundStats} />
          </span>
          <span className="text-center">
            {roundStats.marginDiff == null ? "—" : `+${roundStats.marginDiff}`}
          </span>
          <span className="text-center">
            <UnderdogStatus roundStats={roundStats} />
          </span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground pt-2">
        Accuracy {formatAccuracy(entry.season.accuracy)} from {entry.season.gamesTipped} tipped ·
        Streak {entry.season.currentStreak} (best {entry.season.longestStreak}) · Underdogs{" "}
        {entry.season.totalUnderdogs}
      </p>
    </div>
  );
}

function PlayerStatsSkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <Skeleton className="h-4 w-4 rounded" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="text-center space-y-1 w-12">
            <Skeleton className="h-4 w-8 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlayerStatsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Tipster Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <PlayerStatsSkeletonRow key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

type PlayerStatsProps = {
  /** The Round to show in "By Round", from the page's `?round=`; the active Round when absent. */
  round?: number;
  onRoundChange: (round: number) => void;
};

/** Tipster Stats: each Tipster's Round or Season figures, in Leaderboard order. */
export function PlayerStats({ round, onRoundChange }: PlayerStatsProps) {
  const season = useSeason();
  const { data: stats, isLoading, isError, refetch } = useQuery(aflQueries.playerStats(season));
  const user = useCurrentUser();

  const { data: games } = useQuery(aflQueries.allGames(season));
  const activeRound = useMemo(() => (games ? AflGame.getActiveRound(games) : 0), [games]);

  const availableRounds = useMemo(() => stats?.[0]?.rounds ?? [], [stats]);
  const [view, setView] = useState<StatsView>("round");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Default to the current active round, falling back to the last available round
  const defaultRoundIndex = useMemo(() => {
    const idx = availableRounds.findIndex((r) => r.round === activeRound);
    return idx !== -1 ? idx : Math.max(0, availableRounds.length - 1);
  }, [availableRounds, activeRound]);

  const selectedRoundIndex =
    round === undefined ? -1 : availableRounds.findIndex((r) => r.round === round);
  const roundIndex = selectedRoundIndex !== -1 ? selectedRoundIndex : defaultRoundIndex;

  if (isLoading) return <PlayerStatsSkeleton />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p>Failed to load Tipster stats. Please try again later.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!stats || availableRounds.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No stats to show yet. Stats appear once tips are submitted and games are played.
        </CardContent>
      </Card>
    );
  }

  const currentRoundData = availableRounds[roundIndex];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Tipster Stats
          </CardTitle>
          <SegmentedControl
            label="Stats by"
            value={view}
            onChange={setView}
            options={VIEW_OPTIONS}
          />
        </div>

        {view === "round" ? (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {currentRoundData?.isFinals
                ? "Finals round - underdog rule does not apply."
                : `Minimum ${GameRules.MINIMUM_UNDERDOGS_PER_ROUND} underdog tips required per round.`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous round"
                className="size-10"
                onClick={() => onRoundChange(availableRounds[Math.max(0, roundIndex - 1)]!.round)}
                disabled={roundIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-17.5 text-center">
                Round {currentRoundData?.round}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next round"
                className="size-10"
                onClick={() =>
                  onRoundChange(
                    availableRounds[Math.min(availableRounds.length - 1, roundIndex + 1)]!.round,
                  )
                }
                disabled={roundIndex === availableRounds.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            Whole-season totals. Accuracy counts only games you tipped; streaks are consecutive
            correct tips.
          </p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {/* Server order matches the leaderboard: correct tips desc, margin diff asc */}
        {stats.map((entry) => (
          <PlayerStatsRow
            key={entry.userId}
            entry={entry}
            view={view}
            roundIndex={roundIndex}
            isCurrentUser={entry.userId === user?.id}
            isExpanded={expandedUserId === entry.userId}
            onToggle={() =>
              setExpandedUserId((current) => (current === entry.userId ? null : entry.userId))
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}
