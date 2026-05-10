import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DesktopTippingFrame,
  MobileTippingFrame,
} from "~/features/afl-tipping/components/tipping-frames";
import { useIsMobile } from "~/lib/use-is-mobile";

const TABS = [
  { id: "tips", label: "My Tips" },
  { id: "group-tips", label: "Player Tips" },
  { id: "standings", label: "Ladder" },
  { id: "leaderboard", label: "Leaderboard" },
] as const;

const aflTippingSearchSchema = z.object({
  round: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/_authenticated/afl-tipping")({
  validateSearch: aflTippingSearchSchema,
  component: AflTippingLayout,
});

function AflTippingLayout() {
  const { location } = useRouterState();
  const activeTab = location.pathname.split("/").pop() ?? "tips";
  const isMobile = useIsMobile();

  const tabsList = (
    <TabsList className="w-full mb-2 shrink-0 md:p-0.75 md:rounded-lg">
      {TABS.map((tab) => (
        <TabsTrigger key={tab.id} value={tab.id} asChild>
          <Link to={`/afl-tipping/${tab.id}`} search={(prev) => prev}>
            {tab.label}
          </Link>
        </TabsTrigger>
      ))}
    </TabsList>
  );

  if (isMobile) {
    return (
      <MobileTippingFrame>
        <Tabs value={activeTab} className="gap-0 flex-1 flex flex-col min-h-0">
          {tabsList}
          <div className="flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        </Tabs>
      </MobileTippingFrame>
    );
  }

  return (
    <DesktopTippingFrame>
      <Tabs value={activeTab} className="gap-2">
        {tabsList}
        <div className="pt-2">
          <Outlet />
        </div>
      </Tabs>
    </DesktopTippingFrame>
  );
}
