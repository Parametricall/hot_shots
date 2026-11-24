import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check } from "lucide-react";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import { useCurrentRound } from "~/features/afl-tipping/providers/current-round-provider";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import { cn } from "~/lib/utils";
import type { AflUserTip } from "~/features/afl-tipping/types";

type UnderdogChipProps = {
  /** The Tipster's Underdog tips this Round. */
  count: number;
  /** Whether the Model has tipped the Round's Games: until then nothing is an Underdog tip. */
  hasModelTips: boolean;
  isFinals: boolean;
};

/**
 * The Underdog quota as a chip: "Underdogs 1/2", amber with a warning while the Tipster is below
 * the quota and green with a tick once they've met it. Tapping it explains the rule. It is hidden
 * in Finals, where there is no quota, and until the Model has tipped the Round's Games, since a
 * Tip made before then is neither an Underdog tip nor a Favourite tip (see the Glossary).
 */
export function UnderdogChip({ count, hasModelTips, isFinals }: UnderdogChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const quota = GameRules.MINIMUM_UNDERDOGS_PER_ROUND;

  if (isFinals || !hasModelTips) return null;

  const isMet = count >= quota;

  return (
    <div className="contents">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="underdog-quota-explainer"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
          isMet
            ? "border-green-300 bg-green-50 text-green-800"
            : "border-amber-300 bg-amber-50 text-amber-800",
        )}
      >
        {isMet ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <AlertTriangle className="size-3.5" aria-hidden />
        )}
        Underdogs {Math.min(count, quota)}/{quota}
      </button>
      {isOpen && (
        <p
          id="underdog-quota-explainer"
          className="basis-full rounded-md bg-muted px-3 py-2 text-sm text-foreground"
        >
          Tip against the Model at least {quota} times each Round (outside Finals). You&#39;ve
          tipped {count} Underdog{count !== 1 ? "s" : ""} this Round. It doesn&#39;t cost points.
          Don&#39;t be a shit bloke.
        </p>
      )}
    </div>
  );
}

/** Counts the Underdog tips among a Round's Tips. */
export function countUnderdogTips(tips: AflUserTip[] | undefined, gameIds: number[]): number {
  if (!tips) return 0;
  const ids = new Set(gameIds);
  return tips.filter((tip) => ids.has(tip.gameId) && tip.isUnderdog === true).length;
}

/** The Round's Underdog chip, from the cache. */
export function UnderdogWarning() {
  const season = useSeason();
  const currentRound = useCurrentRound();

  const { data: roundGames } = useQuery({
    ...aflQueries.allGames(season),
    select: (games) => games.filter(AflGame.byRound(currentRound)),
  });

  const gameIds = useMemo(() => roundGames?.map((g) => g.id) ?? [], [roundGames]);

  const { data: tips } = useQuery({
    ...aflQueries.getTips(season, gameIds),
    enabled: gameIds.length > 0,
  });
  const { data: modelTips } = useQuery(aflQueries.modelTips(season, currentRound));

  if (!roundGames || !tips) return null;

  return (
    <UnderdogChip
      count={countUnderdogTips(tips, gameIds)}
      hasModelTips={modelTips?.some((tip) => tip.tipTeamId != null) ?? false}
      isFinals={roundGames.some((g) => g.isFinals)}
    />
  );
}
