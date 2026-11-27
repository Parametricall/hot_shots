import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { AflLeaderboardEntry } from "~/features/afl-tipping/types";
import { getInitials } from "~/lib/utils";

/** Pieces the over and upcoming Season summaries share. */

const ORDINAL_RULES = new Intl.PluralRules("en-AU", { type: "ordinal" });
const ORDINAL_SUFFIXES: Record<string, string> = { one: "st", two: "nd", few: "rd", other: "th" };

export function ordinal(n: number): string {
  return `${n}${ORDINAL_SUFFIXES[ORDINAL_RULES.select(n)]}`;
}

export function formatStart(at: number): string {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Melbourne",
  }).format(at);
}

export function TipsterAvatar({
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

/** The gold card for whoever is ranked 1st, and everyone level with them. */
export function ChampionCard({
  champions,
  userId,
  title,
  details,
}: {
  champions: AflLeaderboardEntry[];
  userId: string | undefined;
  /** Heading text; defaults to "Champion" or "Champions". */
  title?: string;
  /** Extra content under a Champion's Score line. */
  details?: (entry: AflLeaderboardEntry) => ReactNode;
}) {
  return (
    <Card className="border-yellow-500/50 bg-yellow-500/10">
      <CardHeader className="items-center pb-2 text-center">
        <Trophy className="h-10 w-10 text-yellow-500" aria-hidden />
        <CardTitle id="champion-heading" role="heading" aria-level={2} className="text-lg">
          {title ?? (champions.length > 1 ? "Champions" : "Champion")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {champions.map((entry) => (
          <div key={entry.userId} className="flex flex-col items-center gap-2 text-center">
            <TipsterAvatar entry={entry} className="size-20 border-4 border-yellow-500 text-xl" />
            <p className="text-xl font-semibold">
              {entry.displayName}
              {entry.userId === userId && (
                <Badge variant="secondary" className="ml-2 align-middle text-xs">
                  You
                </Badge>
              )}
            </p>
            {details?.(entry)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
