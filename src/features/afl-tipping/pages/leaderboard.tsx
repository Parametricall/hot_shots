import { useQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { Leaderboard } from "~/features/afl-tipping/components/leaderboard";
import { WoodenSpoonCard } from "~/features/afl-tipping/components/season-summary/season-summary-view";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { seasonStatus, woodenSpoon } from "~/features/afl-tipping/utils/afl-season";
import { now } from "~/lib/clock";

/**
 * The Leaderboard tab: "<Season> Leaderboard" as the title, the Tipsters ranked, and the Wooden
 * spoon once the Season is over. The Season switcher is under ⋯ More.
 */
export function LeaderboardPage() {
  const season = useSeason();
  const leaderboard = useQuery(aflQueries.leaderboard(season));
  const games = useQuery(aflQueries.allGames(season));

  const spoon =
    leaderboard.data && games.data && seasonStatus(games.data, now()) === "over"
      ? woodenSpoon(leaderboard.data)
      : [];

  return (
    <div className="flex flex-col gap-4" data-app-ready>
      <Leaderboard title={<h2>{season} Leaderboard</h2>} />
      {spoon.length > 0 && <WoodenSpoonCard entries={spoon} />}
    </div>
  );
}
