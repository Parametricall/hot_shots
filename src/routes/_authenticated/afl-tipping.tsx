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
 * The frame every AFL Tipping page sits in, and the Demo's Time control. The Season and its
 * sections (the bottom bar on a phone, tabs on desktop) live one level down, in `$season.tsx`.
 */
function AflTippingLayout() {
  const isMobile = useIsMobile();

  // The Time control is fixed to the bottom of the screen, so the page leaves room for it. On a
  // phone it stacks above the bottom tab bar (the frame adds its height to the bar's).
  const frameClassName = DemoTimeControl ? "md:pb-20" : undefined;
  const timeControl = DemoTimeControl && (
    <Suspense fallback={null}>
      <DemoTimeControl stackedAboveBottomBar={isMobile} />
    </Suspense>
  );

  if (isMobile) {
    return (
      <MobileTippingFrame bottomExtra={DemoTimeControl ? "7rem" : undefined}>
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
