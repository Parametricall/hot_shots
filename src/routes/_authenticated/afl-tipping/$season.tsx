import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { useSeasonTab } from "~/features/afl-tipping/hooks/use-season-tab";
import { SeasonBottomBar } from "~/features/afl-tipping/components/season-bottom-bar";
import { SeasonMoreMenu } from "~/features/afl-tipping/components/season-more-menu";
import { SEASON_SECTIONS } from "~/features/afl-tipping/components/season-tabs";
import { PastSeasonBanner } from "~/features/afl-tipping/components/past-season-banner";
import { useIsMobile } from "~/lib/use-is-mobile";

const aflTippingSearchSchema = z.object({
  round: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/_authenticated/afl-tipping/$season")({
  // Not a number parses to NaN, which isn't one of the Seasons, so it is Not Found below, like a
  // year before FIRST_SEASON or after the Current Season. Throwing from `parse` would show the
  // error component instead.
  params: {
    parse: ({ season }) => ({ season: Number(season) }),
    stringify: ({ season }) => ({ season: String(season) }),
  },
  validateSearch: aflTippingSearchSchema,
  beforeLoad: async ({ params, context: { queryClient } }) => {
    const { seasons } = await queryClient.ensureQueryData(aflQueries.seasons());
    if (!seasons.includes(params.season)) throw notFound();
  },
  component: SeasonLayout,
});

/**
 * A Season's four sections, over its pages: Tips, Round, Leaderboard and Stats. Phones get them as
 * a bar fixed to the bottom of the screen; desktop as a row of tabs at the top. The Season summary
 * has no section: the App opens on it between Seasons, and the Leaderboard covers it the rest of
 * the time. After the sections comes ⋯ More, which holds the Season switcher: findable, but out of
 * the way, since Tipsters rarely change Season. The page scrolls as a whole (no inner scroller), so a phone's browser bars
 * can tuck away.
 */
function SeasonLayout() {
  const season = useSeason();
  const activeTab = useSeasonTab();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        <PastSeasonBanner />
        <Outlet />
        <SeasonBottomBar season={season} activeTab={activeTab} />
      </>
    );
  }

  return (
    <Tabs value={activeTab} className="gap-2">
      <div className="flex items-center gap-2">
        <TabsList className="flex-1 shrink-0 md:p-0.75 md:rounded-lg">
          {SEASON_SECTIONS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} asChild>
              <Link
                to={`/afl-tipping/$season/${tab.id}`}
                params={{ season }}
                search={(prev) => ({ round: prev.round })}
              >
                {tab.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
        <SeasonMoreMenu season={season} activeTab={activeTab} variant="button" />
      </div>
      <PastSeasonBanner />
      <div className="pt-2">
        <Outlet />
      </div>
    </Tabs>
  );
}
