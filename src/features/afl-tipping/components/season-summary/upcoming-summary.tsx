import { Link } from "@tanstack/react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { WoodenSpoon } from "~/components/wooden-spoon";
import {
  ChampionCard,
  formatStart,
  ordinal,
  TipsterAvatar,
} from "~/features/afl-tipping/components/season-summary/season-summary-parts";
import type { SeasonSummaryViewProps } from "~/features/afl-tipping/components/season-summary/season-summary-view";
import { isWithinTippingLead } from "~/features/afl-tipping/utils/afl-season";
import {
  daysUntil,
  preSeason,
  type PreviousTipster,
} from "~/features/afl-tipping/utils/pre-season";
import { now as clockNow } from "~/lib/clock";

function countdown(firstGameAt: number | null, now: number): string {
  if (firstGameAt === null) return "The Fixture isn't out yet";
  const days = daysUntil(firstGameAt, now);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return `Opening Round starts ${formatStart(firstGameAt)} · ${when}`;
}

function BackMarker({ isBack, season }: { isBack: boolean; season: number }) {
  return (
    <Badge variant={isBack ? "secondary" : "outline"} className="text-xs">
      {isBack ? `Back for ${season}` : "Not back yet"}
    </Badge>
  );
}

function YouBadge({ userId, id }: { userId: string | undefined; id: string }) {
  if (userId !== id) return null;
  return (
    <Badge variant="secondary" className="text-xs">
      You
    </Badge>
  );
}

function LastSeasonWoodenSpoon({
  holders,
  season,
  userId,
}: {
  holders: PreviousTipster[];
  season: number;
  userId: string | undefined;
}) {
  return (
    <Card className="py-3">
      <CardContent className="flex flex-col gap-2 px-4">
        <div className="flex items-center gap-3">
          <WoodenSpoon size={18} />
          <p className="text-sm font-semibold">Wooden spoon, {season - 1}</p>
        </div>
        <ul className="flex flex-col gap-1">
          {holders.map(({ entry, isBack }) => (
            <li key={entry.userId} className="flex items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 truncate">{entry.displayName}</span>
              <YouBadge userId={userId} id={entry.userId} />
              <BackMarker isBack={isBack} season={season} />
            </li>
          ))}
        </ul>
        {holders.some((holder) => holder.isBack) && (
          <p className="text-xs text-muted-foreground">Back and out for redemption.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** An upcoming Season: who is tipping, and how last Season's Champion and Wooden spoon fared. */
export function UpcomingSummary({
  season,
  firstGameAt,
  leaderboard,
  userId,
  previousLeaderboard = null,
  now = clockNow(),
}: SeasonSummaryViewProps) {
  const { hasPrevious, entrants, champions, woodenSpoon, notBack } = preSeason(
    leaderboard,
    previousLeaderboard,
  );
  const isTippingTime = isWithinTippingLead(firstGameAt, now);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{season} Season</h1>
        <p className="text-sm text-muted-foreground">{countdown(firstGameAt, now)}</p>
      </div>

      <Button asChild size="lg" variant={isTippingTime ? "default" : "outline"}>
        <Link to="/afl-tipping/$season/tips" params={{ season }} search={{}}>
          Tip Opening Round
        </Link>
      </Button>

      {champions.length > 0 && (
        <section aria-labelledby="champion-heading">
          <ChampionCard
            champions={champions.map((champion) => champion.entry)}
            userId={userId}
            title={champions.length > 1 ? "Last Season's Champions" : "Last Season's Champion"}
            details={(entry) => (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{entry.score}</span> Score in{" "}
                  {season - 1}
                </p>
                <BackMarker
                  isBack={champions.find((c) => c.entry.userId === entry.userId)?.isBack ?? false}
                  season={season}
                />
              </>
            )}
          />
        </section>
      )}

      {woodenSpoon.length > 0 && (
        <LastSeasonWoodenSpoon holders={woodenSpoon} season={season} userId={userId} />
      )}

      <section aria-labelledby="entrants-heading" className="flex flex-col gap-2">
        <h2 id="entrants-heading" className="text-lg font-semibold">
          Who&apos;s tipping in {season}
        </h2>
        {entrants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has entered yet.</p>
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              <ul>
                {entrants.map(({ entry, lastRank, lastRankIsTied }) => (
                  <li
                    key={entry.userId}
                    className="flex items-center gap-3 p-3 border-b last:border-b-0"
                  >
                    <TipsterAvatar entry={entry} className="size-8 text-xs" />
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">
                      {entry.displayName}
                    </span>
                    <YouBadge userId={userId} id={entry.userId} />
                    {hasPrevious && (
                      <span className="text-xs text-muted-foreground">
                        {lastRank === null
                          ? "New"
                          : `${lastRankIsTied ? "=" : ""}${ordinal(lastRank)} in ${season - 1}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {notBack.length > 0 && (
        <section aria-labelledby="not-back-heading" className="flex flex-col gap-2">
          <h2 id="not-back-heading" className="text-lg font-semibold">
            Not back yet
          </h2>
          <ul className="flex flex-col gap-2 text-muted-foreground">
            {notBack.map(({ entry, rank }) => (
              <li key={entry.userId} className="flex items-center gap-3 opacity-70">
                <TipsterAvatar entry={entry} className="size-8 text-xs" />
                <span className="flex-1 min-w-0 text-sm truncate">{entry.displayName}</span>
                <span className="text-xs">
                  {ordinal(rank)} in {season - 1}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
