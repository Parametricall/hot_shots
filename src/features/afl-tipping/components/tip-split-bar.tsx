import { Bot } from "lucide-react";
import type { AflTeam } from "~/features/afl-tipping/types";
import { cn } from "~/lib/utils";

type TipSplitBarProps = {
  homeTeam: AflTeam;
  awayTeam: AflTeam;
  homeCount: number;
  awayCount: number;
  /** The team the Model tipped, if it has tipped the Game. */
  modelTipTeamId?: number | null;
};

/** Whole-number shares that add to 100, so the two labels never read 51% and 50%. */
export function splitPercentages(homeCount: number, awayCount: number) {
  const total = homeCount + awayCount;
  if (total === 0) return null;
  const home = Math.round((homeCount / total) * 100);
  return { home, away: 100 - home };
}

/**
 * How the Round's Tipsters split on a Game that has started: a bar of home against away, with each
 * side's share and the team's abbreviation, and the Model tip marked. It only appears from Lockout,
 * when every Tip becomes visible (see the Glossary): before then who tipped what stays hidden.
 *
 * The Home team is blue and the Away team orange, not the clubs' colours: the app holds none, and
 * two fixed colours keep the bar readable for any pairing.
 */
export function TipSplitBar({
  homeTeam,
  awayTeam,
  homeCount,
  awayCount,
  modelTipTeamId,
}: TipSplitBarProps) {
  const split = splitPercentages(homeCount, awayCount);
  if (!split) return null;

  const modelTip =
    modelTipTeamId === homeTeam.id ? homeTeam : modelTipTeamId === awayTeam.id ? awayTeam : null;

  return (
    <div
      role="img"
      aria-label={`${homeTeam.abbrev} ${split.home}%, ${awayTeam.abbrev} ${split.away}%${
        modelTip ? `. Model tip: ${modelTip.abbrev}` : ""
      }`}
      className="space-y-1"
    >
      <div className="flex justify-between text-xs font-medium tabular-nums" aria-hidden>
        <span>
          {homeTeam.abbrev} {split.home}%
        </span>
        <span>
          {split.away}% {awayTeam.abbrev}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="bg-sky-500" style={{ width: `${split.home}%` }} />
        <div className="bg-orange-500" style={{ width: `${split.away}%` }} />
      </div>
      {modelTip && (
        <div
          aria-hidden
          className={cn(
            "flex items-center gap-1 text-xs text-muted-foreground",
            modelTip.id === awayTeam.id && "justify-end",
          )}
        >
          <Bot className="size-3.5" />
          Model tip: {modelTip.abbrev}
        </div>
      )}
    </div>
  );
}
