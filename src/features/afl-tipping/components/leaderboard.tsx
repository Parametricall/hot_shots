import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "~/features/auth/use-current-user";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Trophy, Medal, Award, AlertCircle } from "lucide-react";
import { WoodenSpoon } from "~/components/wooden-spoon";
import { cn } from "~/lib/utils";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import { rankEntries } from "~/features/afl-tipping/utils/afl-season";
import {
  leaderboardMovement,
  type LeaderboardMovement,
} from "~/features/afl-tipping/utils/leaderboard-movement";

const DEFAULT_TITLE = "Leaderboard";

/** A CSS length in pixels, resolved where `el` sits, so `var()` and `env()` count. */
function resolveLengthPx(el: HTMLElement, length: string): number {
  const probe = document.createElement("div");
  probe.style.cssText = `position:fixed;visibility:hidden;pointer-events:none;height:${length}`;
  el.appendChild(probe);
  const px = probe.offsetHeight;
  probe.remove();
  return px;
}

function getRankIcon(rank: number, lastRank?: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  if (lastRank != null && rank === lastRank) return <WoodenSpoon size={12} />;
  return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
}

/** Places gained or lost since the Round before: "▲2", "▼1", or a dash. */
function Movement({ delta }: { delta: number | null | undefined }) {
  if (delta == null || delta === 0) {
    return (
      <span className="text-[11px] leading-none text-muted-foreground">
        <span aria-hidden>–</span>
        <span className="sr-only">{delta === 0 ? "No change" : "No movement yet"}</span>
      </span>
    );
  }
  const isUp = delta > 0;
  const places = Math.abs(delta);
  return (
    <span
      className={cn(
        "text-[11px] leading-none font-medium",
        isUp ? "text-green-600" : "text-red-600",
      )}
    >
      <span aria-hidden>
        {isUp ? "▲" : "▼"}
        {places}
      </span>
      <span className="sr-only">
        {isUp ? "Up" : "Down"} {places} {places === 1 ? "place" : "places"}
      </span>
    </span>
  );
}

const COLUMNS = {
  rank: "w-10 shrink-0",
  round: "w-9 shrink-0 text-center",
  score: "w-10 shrink-0 text-center",
  margin: "w-14 shrink-0 text-center",
} as const;

function LeaderboardHeader({ round }: { round: number | null }) {
  return (
    <div className="flex items-end gap-2 border-b px-3 pb-1 text-xs leading-tight text-muted-foreground">
      <span className={COLUMNS.rank}>
        <span className="sr-only">Rank</span>
      </span>
      <span className="min-w-0 flex-1">Tipster</span>
      <span className={COLUMNS.round}>
        Rnd
        {round !== null && <span className="sr-only"> (Correct tips in Round {round})</span>}
      </span>
      <span className={COLUMNS.score}>Score</span>
      <span className={COLUMNS.margin}>Margin diff</span>
    </div>
  );
}

type LeaderboardRowProps = {
  entry: AflLeaderboardEntry;
  rank: number;
  lastRank: number;
  isCurrentUser: boolean;
  /** Places gained since the Round before. */
  movement?: number | null;
  /** Correct tips in the latest Round. */
  roundCorrect?: number;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  "data-testid"?: string;
};

function LeaderboardRow({
  entry,
  rank,
  lastRank,
  isCurrentUser,
  movement,
  roundCorrect,
  className,
  ref,
  "data-testid": testId,
}: LeaderboardRowProps) {
  return (
    <div
      ref={ref}
      data-testid={testId}
      className={cn(
        "flex items-center gap-2 p-3 border-b last:border-b-0",
        isCurrentUser && "bg-blue-50 border-blue-200",
        className,
      )}
    >
      <div className={cn(COLUMNS.rank, "flex flex-col items-center gap-0.5")}>
        {getRankIcon(rank, lastRank)}
        <Movement delta={movement} />
      </div>

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

      <span className={cn(COLUMNS.round, "text-sm tabular-nums text-muted-foreground")}>
        {roundCorrect ?? "–"}
      </span>
      <span className={cn(COLUMNS.score, "text-sm font-semibold tabular-nums")}>{entry.score}</span>
      <span className={cn(COLUMNS.margin, "text-sm tabular-nums")}>{entry.totalMarginDiff}</span>
    </div>
  );
}

function LeaderboardSkeletonRow() {
  return (
    <div className="flex items-center gap-2 p-3 border-b last:border-b-0">
      <div className={cn(COLUMNS.rank, "flex justify-center")}>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-4 w-6" />
      <Skeleton className="h-4 w-8" />
      <Skeleton className="h-4 w-10" />
    </div>
  );
}

export function LeaderboardSkeleton({ title = DEFAULT_TITLE }: { title?: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <LeaderboardSkeletonRow key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

type LeaderboardProps = {
  /** The card's title; the Leaderboard page passes "<Season> Leaderboard". */
  title?: ReactNode;
};

/**
 * The Leaderboard: rank (with the places gained or lost since the Round before), Tipster, Correct
 * tips in the latest Round ("Rnd"), Score and Margin difference. The movement and "Rnd" come from
 * the Tipsters' per-Round stats, so they appear a beat after the ranking. When the viewer's own
 * row is scrolled out of view, a copy of it is pinned to the bottom of the list, above the bottom
 * bar, so a Tipster always sees where they stand.
 */
export function Leaderboard({ title = DEFAULT_TITLE }: LeaderboardProps) {
  const season = useSeason();
  const {
    data: leaderboard,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    ...aflQueries.leaderboard(season),
  });
  const { data: playerStats } = useQuery(aflQueries.playerStats(season));
  const movement: LeaderboardMovement | undefined = useMemo(
    () => (playerStats ? leaderboardMovement(playerStats) : undefined),
    [playerStats],
  );
  const user = useCurrentUser();

  const ownRowRef = useRef<HTMLDivElement>(null);
  const [isOwnRowVisible, setIsOwnRowVisible] = useState(true);
  const hasOwnRow = leaderboard?.some((entry) => entry.userId === user?.id) ?? false;
  useEffect(() => {
    const row = ownRowRef.current;
    if (!row || typeof IntersectionObserver === "undefined") return;
    // The sticky header and the bottom bar cover the ends of the screen: a row behind them is out
    // of view, so shrink the viewport the observer sees by their heights.
    const top = resolveLengthPx(row, "var(--header-h, 0px)");
    const bottom = resolveLengthPx(row, "var(--bottom-stack-h, 0px)");
    const observer = new IntersectionObserver(
      ([change]) => setIsOwnRowVisible(change?.isIntersecting ?? true),
      { rootMargin: `-${top}px 0px -${bottom}px 0px` },
    );
    observer.observe(row);
    return () => observer.disconnect();
  }, [hasOwnRow]);

  if (isLoading || (!leaderboard && isFetching)) return <LeaderboardSkeleton title={title} />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p>Failed to load the leaderboard. Please try again later.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No tips have been submitted yet. Be the first to tip!
        </CardContent>
      </Card>
    );
  }

  const ranks = rankEntries(leaderboard);
  const lastRank = ranks[ranks.length - 1]!;
  const ownIndex = leaderboard.findIndex((entry) => entry.userId === user?.id);

  const rowProps = (index: number) => {
    const entry = leaderboard[index]!;
    return {
      entry,
      rank: ranks[index]!,
      lastRank,
      isCurrentUser: entry.userId === user?.id,
      movement: movement?.movement[entry.userId],
      roundCorrect: movement ? (movement.roundCorrect[entry.userId] ?? 0) : undefined,
    };
  };

  return (
    <Card className="gap-2 py-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <LeaderboardHeader round={movement?.round ?? null} />
        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.userId}
            ref={index === ownIndex ? ownRowRef : undefined}
            {...rowProps(index)}
          />
        ))}
        {ownIndex !== -1 && !isOwnRowVisible && (
          <LeaderboardRow
            {...rowProps(ownIndex)}
            data-testid="own-row-pinned"
            className="sticky bottom-[var(--bottom-stack-h,0px)] z-20 border-t bg-blue-50 shadow-[0_-2px_8px_rgb(0_0_0/0.08)]"
          />
        )}
      </CardContent>
    </Card>
  );
}
