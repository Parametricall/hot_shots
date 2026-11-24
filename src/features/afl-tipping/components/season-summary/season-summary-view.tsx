import { Link } from "@tanstack/react-router";
import { Award, Medal, Trophy } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { WoodenSpoon } from "~/components/wooden-spoon";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import {
  podium,
  rankEntries,
  woodenSpoon,
  type SeasonStatus,
} from "~/features/afl-tipping/utils/afl-season";

export type SeasonSummaryViewProps = {
  season: number;
  status: SeasonStatus;
  /** When the first Game starts, epoch ms. */
  firstGameAt: number | null;
  /** The Round to tip next, as the AFL names it: "Round 5", "Qualifying Final". */
  activeRoundName: string | null;
  /** The Leaderboard, in order. */
  leaderboard: AflLeaderboardEntry[];
  /** The viewer's id, to find their own finish. */
  userId: string | undefined;
};

const ORDINAL_RULES = new Intl.PluralRules("en-AU", { type: "ordinal" });
const ORDINAL_SUFFIXES: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

function ordinal(n: number): string {
  return `${n}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(n)]}`;
}

function formatStart(at: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Melbourne",
  }).format(at);
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" aria-hidden />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" aria-hidden />;
  return <Award className="h-5 w-5 text-amber-600" aria-hidden />;
}

function PodiumRow({
  entry,
  rank,
  isTied,
  isCurrentUser,
}: {
  entry: AflLeaderboardEntry;
  rank: number;
  isTied: boolean;
  isCurrentUser: boolean;
}) {
  return (
    <li className="flex items-center gap-3 p-3 border-b last:border-b-0">
      <RankIcon rank={rank} />
      <span className="w-10 text-sm font-medium text-muted-foreground">
        {isTied ? "=" : ""}
        {ordinal(rank)}
      </span>
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{entry.displayName}</span>
      {isCurrentUser && (
        <Badge variant="secondary" className="text-xs">
          You
        </Badge>
      )}
      <span className="text-sm font-semibold">{entry.score}</span>
    </li>
  );
}

function NoScores() {
  return (
    <Card>
      <CardContent className="py-6 text-center text-sm text-muted-foreground">
        No scores yet
      </CardContent>
    </Card>
  );
}

function PodiumCard({
  leaderboard,
  userId,
  title,
}: {
  leaderboard: AflLeaderboardEntry[];
  userId: string | undefined;
  title: string;
}) {
  const ranks = rankEntries(leaderboard);
  const top = podium(leaderboard);
  if (top.length === 0) return <NoScores />;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ol>
          {top.map((entry, i) => {
            const rank = ranks[i]!;
            return (
              <PodiumRow
                key={entry.userId}
                entry={entry}
                rank={rank}
                isTied={ranks.filter((r) => r === rank).length > 1}
                isCurrentUser={entry.userId === userId}
              />
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function WoodenSpoonCard({ entries }: { entries: AflLeaderboardEntry[] }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <WoodenSpoon size={18} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Wooden spoon</p>
          <p className="text-sm text-muted-foreground">
            {entries.map((entry) => entry.displayName).join(", ")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** The viewer's own finish: "You're 7th of 15", or "You finished 7th of 15" once the Season is over. */
function ownFinish(
  leaderboard: AflLeaderboardEntry[],
  userId: string | undefined,
  status: SeasonStatus,
): string | null {
  if (status === "upcoming" || userId === undefined) return null;
  const index = leaderboard.findIndex((entry) => entry.userId === userId);
  if (index === -1) return null;
  const rank = rankEntries(leaderboard)[index]!;
  return status === "over"
    ? `You finished ${ordinal(rank)} of ${leaderboard.length}`
    : `You're ${ordinal(rank)} of ${leaderboard.length}`;
}

/** The Season summary, from data. `SeasonSummary` fetches it. */
export function SeasonSummaryView({
  season,
  status,
  firstGameAt,
  activeRoundName,
  leaderboard,
  userId,
}: SeasonSummaryViewProps) {
  const finish = ownFinish(leaderboard, userId, status);
  const spoon = status === "over" ? woodenSpoon(leaderboard) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">
          {status === "over" ? `${season} Season, final` : `${season} Season`}
        </h1>
        {status === "upcoming" && firstGameAt !== null && (
          <p className="text-sm text-muted-foreground">
            Opening Round starts {formatStart(firstGameAt)}
          </p>
        )}
        {finish && <p className="text-sm text-muted-foreground">{finish}</p>}
      </div>

      {status !== "over" && (
        <Button asChild size="lg">
          <Link to="/afl-tipping/$season/tips" params={{ season }} search={{}}>
            Tip {activeRoundName ?? "Opening Round"}
          </Link>
        </Button>
      )}

      {status === "upcoming" ? (
        <NoScores />
      ) : (
        <PodiumCard
          leaderboard={leaderboard}
          userId={userId}
          title={status === "over" ? "Podium" : "Top three so far"}
        />
      )}

      {spoon.length > 0 && <WoodenSpoonCard entries={spoon} />}

      {status === "over" && (
        <Button asChild variant="outline">
          <Link to="/afl-tipping/$season/leaderboard" params={{ season }} search={{}}>
            Full Leaderboard
          </Link>
        </Button>
      )}
    </div>
  );
}
