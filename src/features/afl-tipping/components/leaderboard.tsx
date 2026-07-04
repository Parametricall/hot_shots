import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Trophy, Medal, Award, AlertCircle, Flag, MoreVertical } from "lucide-react";
import { WoodenSpoon } from "~/components/wooden-spoon";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import ServiceRegistry from "~/app/service-registry";

const ADMIN_USER_ID = import.meta.env.VITE_ADMIN_USER_ID;

function getRankIcon(rank: number, lastRank?: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  if (lastRank != null && rank === lastRank) return <WoodenSpoon size={12} />;
  return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{rank}</span>;
}

interface LeaderboardRowProps {
  entry: AflLeaderboardEntry;
  rank: number;
  lastRank: number;
  isCurrentUser: boolean;
  onReport?: () => void;
  showMenuColumn?: boolean;
}

function LeaderboardRow({
  entry,
  rank,
  lastRank,
  isCurrentUser,
  onReport,
  showMenuColumn,
}: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 border-b last:border-b-0",
        isCurrentUser && "bg-blue-50 border-blue-200",
      )}
    >
      <div className="flex items-center justify-center w-8">{getRankIcon(rank, lastRank)}</div>

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

      {showMenuColumn && (
        <div className="w-8 flex justify-center">
          {onReport ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onReport} className="text-red-600">
                  <Flag className="h-4 w-4 mr-2" />
                  Report for cheating
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LeaderboardSkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <div className="flex items-center justify-center w-8">
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
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
  const queryClient = useQueryClient();
  const isAdmin = user?.id === ADMIN_USER_ID;

  const { data: cheatingFlag } = useQuery(aflQueries.featureFlag("cheating_report"));
  const cheatingEnabled = cheatingFlag?.enabled ?? false;

  const toggleMutation = useMutation({
    mutationFn: () =>
      ServiceRegistry.getService("featureFlagsService").setFeatureFlag({
        data: { key: "cheating_report", enabled: !cheatingEnabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: aflQueries.featureFlag("cheating_report").queryKey,
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: ServiceRegistry.getService("cheatingReportsService").reportCheating,
    onSuccess: () => {
      toast.success("Report submitted. The authorities have been notified.");
      queryClient.invalidateQueries({ queryKey: aflQueries.cheatingReports().queryKey });
    },
    onError: () => {
      toast.error("Failed to submit report");
    },
  });

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
    const current = leaderboard[i]!;
    const previous = leaderboard[i - 1];
    if (
      previous &&
      current.score === previous.score &&
      current.totalMarginDiff === previous.totalMarginDiff
    ) {
      ranks.push(ranks[i - 1]!);
    } else {
      ranks.push(i + 1);
    }
  }

  const currentUserIsRyan =
    leaderboard.find((e) => e.userId === user?.id)?.displayName.startsWith("Ryan") ?? false;
  const currentUserIsBrooke =
    leaderboard.find((e) => e.userId === user?.id)?.displayName.startsWith("Brooke") ?? false;
  const showMenuColumn = cheatingEnabled && !currentUserIsRyan && !currentUserIsBrooke;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Tipping Leaderboard
        </CardTitle>
      </CardHeader>
      {isAdmin && (
        <div className="flex justify-end px-4 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className="text-xs"
          >
            <Flag className={cn("h-3.5 w-3.5 mr-1", cheatingEnabled && "text-red-500")} />
            {cheatingEnabled ? "Reporting on" : "Reporting off"}
          </Button>
        </div>
      )}
      <CardContent className="p-0">
        {leaderboard.map((entry, index) => {
          const isCurrentUser = entry.userId === user?.id;
          const canReport =
            showMenuColumn && entry.displayName.startsWith("Ryan") && !isCurrentUser;
          return (
            <LeaderboardRow
              key={entry.userId}
              entry={entry}
              rank={ranks[index]!}
              lastRank={ranks[ranks.length - 1]!}
              isCurrentUser={isCurrentUser}
              showMenuColumn={showMenuColumn}
              onReport={
                canReport
                  ? () => reportMutation.mutate({ data: { userId: entry.userId } })
                  : undefined
              }
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
