import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
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
          <div className="font-semibold">{entry.correctTips}</div>
          <div className="text-xs text-muted-foreground">Correct</div>
        </div>
        <div className="text-center hidden sm:block">
          <div className="font-semibold">{entry.totalTips}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
        <div className="text-center">
          <div className="font-semibold">{entry.accuracy}%</div>
          <div className="text-xs text-muted-foreground">Accuracy</div>
        </div>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { data: leaderboard } = useQuery({
    ...aflQueries.leaderboard(),
  });
  const { user } = useUser();

  if (!leaderboard) return <div>Loading...</div>;

  if (leaderboard.length === 0) {
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
      leaderboard[i].correctTips === leaderboard[i - 1].correctTips &&
      leaderboard[i].accuracy === leaderboard[i - 1].accuracy
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
