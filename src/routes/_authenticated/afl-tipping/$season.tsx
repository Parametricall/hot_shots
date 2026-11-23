import { createFileRoute, Link, notFound, Outlet, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { useSeason } from "~/features/afl-tipping/hooks/use-season";
import { useIsMobile } from "~/lib/use-is-mobile";

const TABS = [
  { id: "tips", label: "My Tips" },
  { id: "group-tips", label: "Player Tips" },
  { id: "standings", label: "Ladder" },
  { id: "stats", label: "Stats" },
] as const;

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

function SeasonLayout() {
  const season = useSeason();
  const { location } = useRouterState();
  // /afl-tipping/<season>/<tab>
  const activeTab = location.pathname.split("/")[3] ?? "summary";
  const isMobile = useIsMobile();

  const tabsList = (
    <TabsList className="w-full mb-2 shrink-0 md:p-0.75 md:rounded-lg">
      {TABS.map((tab) => (
        <TabsTrigger key={tab.id} value={tab.id} asChild>
          <Link to={`/afl-tipping/$season/${tab.id}`} params={{ season }} search={(prev) => prev}>
            {tab.label}
          </Link>
        </TabsTrigger>
      ))}
    </TabsList>
  );

  if (isMobile) {
    return (
      <Tabs value={activeTab} className="gap-0 flex-1 flex flex-col min-h-0">
        {tabsList}
        <div className="flex-1 flex flex-col min-h-0">
          <Outlet />
        </div>
      </Tabs>
    );
  }

  return (
    <Tabs value={activeTab} className="gap-2">
      {tabsList}
      <div className="pt-2">
        <Outlet />
      </div>
    </Tabs>
  );
}
