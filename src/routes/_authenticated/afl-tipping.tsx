import { createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
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

export const Route = createFileRoute("/_authenticated/afl-tipping")({
  head: () => ({
    meta: [{ title: "Hot Shots - AFL" }],
    links: [{ rel: "manifest", href: "/site.webmanifest" }],
  }),
  component: AflTippingLayout,
});

/**
 * The frame every AFL Tipping page sits in, and the Demo's Time control. The Season, its tabs and
 * its switcher live one level down, in `$season.tsx`.
 */
function AflTippingLayout() {
  const isMobile = useIsMobile();

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
        <Outlet />
        {timeControl}
      </MobileTippingFrame>
    );
  }

  return (
    <DesktopTippingFrame className={frameClassName}>
      <Outlet />
      {timeControl}
    </DesktopTippingFrame>
  );
}
