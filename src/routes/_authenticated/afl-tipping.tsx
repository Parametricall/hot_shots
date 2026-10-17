import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  DesktopTippingFrame,
  MobileTippingFrame,
} from "~/features/afl-tipping/components/tipping-frames";
import { useIsMobile } from "~/lib/use-is-mobile";

// The Demo's Time control. The condition is written out, not IS_DEMO: a constant imported from
// another module is not folded until after chunking, so the Demo-only import would still ship
// in production.
const DemoTimeControl =
  import.meta.env.VITE_DEMO === "true"
    ? lazy(() =>
        import("~/features/afl-tipping/demo/components/demo-time-control").then((m) => ({
          default: m.DemoTimeControl,
        })),
      )
    : undefined;

const TABS = [
  { id: "tips", label: "My Tips" },
  { id: "group-tips", label: "Player Tips" },
  { id: "standings", label: "Ladder" },
  { id: "stats", label: "Stats" },
] as const;

const aflTippingSearchSchema = z.object({
  round: z.number().int().nonnegative().optional(),
});

export const Route = createFileRoute("/_authenticated/afl-tipping")({
  validateSearch: aflTippingSearchSchema,
  head: () => ({
    meta: [{ title: "Hot Shots - AFL" }],
    links: [{ rel: "manifest", href: "/site.webmanifest" }],
  }),
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

  // The Time control is fixed to the bottom of the screen, so the page leaves room for it.
  const frameClassName = DemoTimeControl ? "pb-28 md:pb-20" : undefined;
  const timeControl = DemoTimeControl && (
    <Suspense fallback={null}>
      <DemoTimeControl />
    </Suspense>
  );

  if (isMobile) {
    return (
      <MobileTippingFrame className={frameClassName}>
        <Tabs value={activeTab} className="gap-0 flex-1 flex flex-col min-h-0">
          {tabsList}
          <div className="flex-1 flex flex-col min-h-0">
            <Outlet />
          </div>
        </Tabs>
        {timeControl}
      </MobileTippingFrame>
    );
  }

  return (
    <DesktopTippingFrame className={frameClassName}>
      <Tabs value={activeTab} className="gap-2">
        {tabsList}
        <div className="pt-2">
          <Outlet />
        </div>
      </Tabs>
      {timeControl}
    </DesktopTippingFrame>
  );
}
