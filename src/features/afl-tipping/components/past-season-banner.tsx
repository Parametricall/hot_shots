import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { landingFor } from "~/features/afl-tipping/utils/afl-season";
import { now } from "~/lib/clock";

/**
 * Under the tabs of any Season that isn't the Current Season, so a Tipster can't get stuck in last
 * Season. It links to the Current Season's My Tips while that is taking Tips, or to its summary
 * once it is over.
 */
export function PastSeasonBanner() {
  const season = useSeason();
  const { data } = useQuery(aflQueries.seasons());

  if (!data || season === data.current.season) return null;

  const landing = landingFor(data.current, now());
  const label = `Back to ${landing.season}`;

  return (
    <div className="mb-2 flex shrink-0 items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
      <span>You&apos;re viewing {season}.</span>
      {landing.to === "tips" ? (
        <Link
          to="/afl-tipping/$season/tips"
          params={{ season: landing.season }}
          className="font-medium underline underline-offset-4"
        >
          {label}
        </Link>
      ) : (
        <Link
          to="/afl-tipping/$season"
          params={{ season: landing.season }}
          className="font-medium underline underline-offset-4"
        >
          {label}
        </Link>
      )}
    </div>
  );
}
