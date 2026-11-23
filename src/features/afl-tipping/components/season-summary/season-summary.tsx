import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { SeasonSummaryView } from "~/features/afl-tipping/components/season-summary/season-summary-view";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { seasonStatus } from "~/features/afl-tipping/utils/afl-season";
import { useCurrentUser } from "~/features/auth/use-current-user";
import { now } from "~/lib/clock";

export function SeasonSummarySkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="season-summary-skeleton">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function SeasonSummary() {
  const season = useSeason();
  const user = useCurrentUser();
  const leaderboard = useQuery(aflQueries.leaderboard(season));
  const games = useQuery(aflQueries.allGames(season));

  if (leaderboard.isError || games.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p>Failed to load the season summary. Please try again later.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              void leaderboard.refetch();
              void games.refetch();
            }}
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!leaderboard.data || !games.data) return <SeasonSummarySkeleton />;

  // Worked out from the Season's own Games, so past Seasons get a status too.
  const status = seasonStatus(games.data, now());
  const firstGameAt =
    games.data.length > 0 ? Math.min(...games.data.map((game) => game.unixTime)) : null;
  const activeRound = AflGame.getActiveRound(games.data);
  const activeRoundName = games.data.find(AflGame.byRound(activeRound))?.roundName ?? null;

  return (
    <SeasonSummaryView
      season={season}
      status={status}
      firstGameAt={firstGameAt}
      activeRoundName={activeRoundName}
      leaderboard={leaderboard.data}
      userId={user?.id}
    />
  );
}
