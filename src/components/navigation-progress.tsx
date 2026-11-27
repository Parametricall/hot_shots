import { useRouterState } from "@tanstack/react-router";
import { cn } from "~/lib/utils";

type NavigationProgressBarProps = {
  active: boolean;
  className?: string;
};

/**
 * A thin bar across the top of the screen while a navigation is on its way, so a tap always gets
 * an answer even when the next page needs the server first. The router keeps the old page up
 * until the new one is ready, and on its own shows nothing for that wait. The bar appears only
 * after 150 ms (`animate-navigation-progress`), so a navigation from the cache shows nothing.
 * It sits below the notch, over the header's top edge, under `viewport-fit=cover`.
 */
export function NavigationProgressBar({ active, className }: NavigationProgressBarProps) {
  if (!active) return null;

  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 h-0.5",
        className,
      )}
    >
      <div className="h-full w-full bg-primary animate-navigation-progress" />
    </div>
  );
}

/** The bar, shown while the router is between pages. Preloads don't count. */
export function NavigationProgress() {
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });
  return <NavigationProgressBar active={isNavigating} />;
}
