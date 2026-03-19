import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Trophy, Medal, Award, AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
}

interface LeaderboardRowProps {
  entry: AflLeaderboardEntry;
  rank: number;
  isCurrentUser: boolean;
}

function LeaderboardRow({ entry, rank, isCurrentUser }: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 border-b last:border-b-0",
        isCurrentUser && "bg-blue-50 border-blue-200",
      )}
    >
      <div className="flex items-center justify-center w-8">{getRankIcon(rank)}</div>

      {entry.avatarUrl && (
        <img
          src={entry.avatarUrl}
          alt={`${entry.displayName} avatar`}
          className="w-8 h-8 rounded-full"
        />
      )}

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

      <div className="flex items-center gap-4 text-sm">
        <div className="text-center">
          <div className="font-semibold">{entry.score}</div>
          <div className="text-xs text-muted-foreground">Score</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">{entry.totalMarginDiff}</div>
          <div className="text-xs text-muted-foreground">Margin</div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardSkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <div className="flex items-center justify-center w-8">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex items-center gap-4">
        <div className="text-center space-y-1">
          <Skeleton className="h-4 w-8 mx-auto" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-4 w-8 mx-auto" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tipping Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <LeaderboardSkeletonRow key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

export function Leaderboard() {
  const {
    data: leaderboard,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    ...aflQueries.leaderboard(),
  });
  const { user } = useUser();

  if (isLoading || (!leaderboard && isFetching)) return <LeaderboardSkeleton />;

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

  const ranks: number[] = [];
  for (let i = 0; i < leaderboard.length; i++) {
    if (
      i > 0 &&
      leaderboard[i].score === leaderboard[i - 1].score &&
      leaderboard[i].totalMarginDiff === leaderboard[i - 1].totalMarginDiff
    ) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tipping Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {leaderboard.map((entry, index) => (
          <LeaderboardRow
            key={entry.userId}
            entry={entry}
            rank={ranks[index]}
            isCurrentUser={entry.userId === user?.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}
