import { Link } from "@tanstack/react-router";
import { Award, Medal, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { WoodenSpoon } from "~/components/wooden-spoon";
import type { AflLeaderboardEntry, AflPlayerStatsEntry } from "~/features/afl-tipping/types";
import {
  podium,
  rankEntries,
  woodenSpoon,
  type SeasonStatus,
} from "~/features/afl-tipping/utils/afl-season";
import {
  awardsWonBy,
  seasonAwards,
  type SeasonAward,
} from "~/features/afl-tipping/utils/season-awards";
import { getInitials } from "~/lib/utils";

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
  /** Every Tipster's stats, for the Champion's Accuracy and the Season awards (over only). */
  playerStats?: AflPlayerStatsEntry[];
  /** The AFL's name for each Round number ("Qualifying Final"), where it isn't "Round N". */
  roundNames?: Record<number, string>;
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

function TipsterAvatar({
  entry,
  className,
}: {
  entry: Pick<AflLeaderboardEntry, "displayName" | "avatarUrl">;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={entry.avatarUrl ?? undefined} alt="" />
      <AvatarFallback>{getInitials(entry.displayName)}</AvatarFallback>
    </Avatar>
  );
}

function formatAccuracy(accuracy: number | null | undefined): string | null {
  return accuracy === null || accuracy === undefined ? null : `${Math.round(accuracy)}%`;
}

/** The Champion: whoever is ranked 1st, and everyone level with them, then 2nd and 3rd below. */
function ChampionSection({
  leaderboard,
  playerStats,
  userId,
}: {
  leaderboard: AflLeaderboardEntry[];
  playerStats: AflPlayerStatsEntry[];
  userId: string | undefined;
}) {
  const ranks = rankEntries(leaderboard);
  const top = podium(leaderboard);
  if (top.length === 0) return <NoScores />;
  const champions = top.filter((_, i) => ranks[i] === 1);
  const chasers = top.filter((_, i) => ranks[i]! > 1);
  const accuracyOf = (id: string) =>
    formatAccuracy(playerStats.find((stats) => stats.userId === id)?.season.accuracy);

  return (
    <section aria-labelledby="champion-heading" className="flex flex-col gap-3">
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardHeader className="items-center pb-2 text-center">
          <Trophy className="h-10 w-10 text-yellow-500" aria-hidden />
          <CardTitle id="champion-heading" role="heading" aria-level={2} className="text-lg">
            {champions.length > 1 ? "Champions" : "Champion"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {champions.map((entry) => {
            const accuracy = accuracyOf(entry.userId);
            return (
              <div key={entry.userId} className="flex flex-col items-center gap-2 text-center">
                <TipsterAvatar
                  entry={entry}
                  className="size-20 border-4 border-yellow-500 text-xl"
                />
                <p className="text-xl font-semibold">
                  {entry.displayName}
                  {entry.userId === userId && (
                    <Badge variant="secondary" className="ml-2 align-middle text-xs">
                      You
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{entry.score}</span> Score
                  {accuracy && (
                    <>
                      {" · "}
                      <span className="font-semibold text-foreground">{accuracy}</span> Accuracy
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
      {chasers.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ol>
              {chasers.map((entry) => {
                const rank = ranks[top.indexOf(entry)]!;
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
      )}
    </section>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function awardValue(award: SeasonAward, roundNames: Record<number, string>): string {
  switch (award.id) {
    case "longest-streak":
      return `${plural(award.value, "Correct tip", "Correct tips")} in a row`;
    case "perfect-rounds":
      return plural(award.value, "Perfect round", "Perfect rounds");
    case "underdog-tips":
      return plural(award.value, "Underdog tip", "Underdog tips");
    case "best-round": {
      const rounds = (award.rounds ?? []).map((round) => roundNames[round] ?? `Round ${round}`);
      return `${award.value} Correct tips in ${rounds.join(", ")}`;
    }
    case "closest-margins":
      return `${award.value} points off in total`;
  }
}

function AwardCard({
  award,
  roundNames,
  userId,
}: {
  award: SeasonAward;
  roundNames: Record<number, string>;
  userId: string | undefined;
}) {
  return (
    <Card className="gap-1 py-3">
      <CardContent className="flex flex-col gap-1 px-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {award.title}
        </p>
        <p className="text-sm font-semibold">
          {award.winners.map((winner) => winner.displayName).join(", ")}
          {award.winners.some((winner) => winner.userId === userId) && (
            <Badge variant="secondary" className="ml-2 align-middle text-xs">
              You
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{awardValue(award, roundNames)}</p>
      </CardContent>
    </Card>
  );
}

function SeasonAwards({
  awards,
  roundNames,
  userId,
}: {
  awards: SeasonAward[];
  roundNames: Record<number, string>;
  userId: string | undefined;
}) {
  if (awards.length === 0) return null;
  return (
    <section aria-labelledby="awards-heading" className="flex flex-col gap-2">
      <h2 id="awards-heading" className="text-lg font-semibold">
        Season awards
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {awards.map((award) => (
          <AwardCard key={award.id} award={award} roundNames={roundNames} userId={userId} />
        ))}
      </div>
    </section>
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

/** A Season that is over: the Champion, the Wooden spoon and the Season awards. */
function OverSummary({
  season,
  leaderboard,
  userId,
  playerStats = [],
  roundNames = {},
}: SeasonSummaryViewProps) {
  const finish = ownFinish(leaderboard, userId, "over");
  const spoon = woodenSpoon(leaderboard);
  const awards = seasonAwards(playerStats);
  const won = awardsWonBy(awards, userId).map((award) => award.title);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{season} Season, final</h1>
        {finish && <p className="text-sm text-muted-foreground">{finish}</p>}
        {won.length > 0 && (
          <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
            You won {won.join(", ")}
          </p>
        )}
      </div>

      <ChampionSection leaderboard={leaderboard} playerStats={playerStats} userId={userId} />

      {spoon.length > 0 && <WoodenSpoonCard entries={spoon} />}

      <SeasonAwards awards={awards} roundNames={roundNames} userId={userId} />

      <Button asChild variant="outline">
        <Link to="/afl-tipping/$season/leaderboard" params={{ season }} search={{}}>
          Full Leaderboard
        </Link>
      </Button>
    </div>
  );
}

/** A Season that hasn't started or is under way: tip the active Round, and the top three so far. */
function LiveSummary({
  season,
  status,
  firstGameAt,
  activeRoundName,
  leaderboard,
  userId,
}: SeasonSummaryViewProps) {
  const finish = ownFinish(leaderboard, userId, status);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{season} Season</h1>
        {status === "upcoming" && firstGameAt !== null && (
          <p className="text-sm text-muted-foreground">
            Opening Round starts {formatStart(firstGameAt)}
          </p>
        )}
        {finish && <p className="text-sm text-muted-foreground">{finish}</p>}
      </div>

      <Button asChild size="lg">
        <Link to="/afl-tipping/$season/tips" params={{ season }} search={{}}>
          Tip {activeRoundName ?? "Opening Round"}
        </Link>
      </Button>

      {status === "upcoming" ? (
        <NoScores />
      ) : (
        <PodiumCard leaderboard={leaderboard} userId={userId} title="Top three so far" />
      )}
    </div>
  );
}

/** The Season summary, from data. `SeasonSummary` fetches it. */
export function SeasonSummaryView(props: SeasonSummaryViewProps) {
  return props.status === "over" ? <OverSummary {...props} /> : <LiveSummary {...props} />;
}
