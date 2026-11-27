import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SheetClose } from "~/components/ui/sheet";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { seasonTabPath } from "~/features/afl-tipping/components/season-tab-path";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { landingForSeason } from "~/features/afl-tipping/utils/afl-season";
import { now } from "~/lib/clock";
import { cn } from "~/lib/utils";

/**
 * The Seasons, newest first, as a list to pick from inside the More sheet: the one open is ticked
 * and the Current Season is marked. A pick lands where opening the App would for the Current
 * Season, and on the Season summary for any other (`landingForSeason`): someone switching to last
 * Season wants its result, not the tips of its final Round. A pick closes the sheet.
 *
 * It lives in the More sheet, not the header or the Leaderboard's title: a Tipster looking for
 * "other stuff" opens More, and Tipsters rarely change Season, so it shouldn't spend room on every
 * screen. From other tabs of a past Season, `PastSeasonBanner` is the way back to the Current
 * Season.
 */
export function SeasonSwitcher() {
  const season = useSeason();
  const { data } = useQuery(aflQueries.seasons());

  return (
    <section aria-labelledby="season-switcher-heading">
      <h3
        id="season-switcher-heading"
        className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Season
      </h3>
      <ul>
        {(data?.seasons ?? [season]).map((option) => {
          const isOpen = option === season;
          const landing = data
            ? landingForSeason(option, data.current, now())
            : { to: "summary" as const, season: option };
          return (
            <li key={option}>
              <SheetClose asChild>
                <Link
                  to={seasonTabPath(landing.to)}
                  params={{ season: option }}
                  search={{}}
                  aria-current={isOpen ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 px-4 text-base tabular-nums outline-none hover:bg-accent focus-visible:bg-accent",
                    isOpen && "font-semibold",
                  )}
                >
                  <Check
                    className={cn("size-4 text-primary", !isOpen && "invisible")}
                    aria-hidden
                  />
                  {option}
                  {option === data?.current.season && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      Current
                    </span>
                  )}
                </Link>
              </SheetClose>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
