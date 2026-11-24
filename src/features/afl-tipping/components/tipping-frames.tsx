import type { CSSProperties, PropsWithChildren } from "react";
import { Header } from "~/components/header";
import { cn } from "~/lib/utils";

type FrameProps = PropsWithChildren<{ className?: string }>;

type MobileFrameProps = FrameProps & {
  /** A CSS length of extra bar stacked above the bottom tab bar, such as the Demo Time control. */
  bottomExtra?: string;
};

/**
 * The phone's frame. The document scrolls (there is no inner scroller), so the browser's own bars
 * can tuck away; the header is sticky and the tab bar fixed. The frame publishes the heights those
 * two take as CSS variables, so the rest of the page can sit clear of them without magic numbers:
 *
 * - `--header-h`: the sticky header, with the notch's inset.
 * - `--bottom-bar-h`: the fixed bottom tab bar, with the home indicator's inset.
 * - `--bottom-stack-h`: that bar plus anything stacked on it (`bottomExtra`); sticky and fixed
 *   things at the bottom of the screen, such as the Leaderboard's own row, sit above it.
 */
export function MobileTippingFrame({ children, className, bottomExtra = "0px" }: MobileFrameProps) {
  return (
    <div
      className={cn("min-h-dvh flex flex-col", className)}
      style={
        {
          "--header-h": "calc(3rem + env(safe-area-inset-top))",
          "--bottom-bar-h": "calc(3.5rem + env(safe-area-inset-bottom))",
          "--bottom-stack-h": `calc(var(--bottom-bar-h) + ${bottomExtra})`,
          paddingBottom: "calc(var(--bottom-stack-h) + 0.5rem)",
        } as CSSProperties
      }
    >
      <Header className="px-2 sticky top-0 z-50" />
      <div className="container mx-auto py-2 px-2 flex-1 flex flex-col">{children}</div>
    </div>
  );
}

export function DesktopTippingFrame({ children, className }: FrameProps) {
  return (
    <div
      className={cn("min-h-screen", className)}
      style={{ "--header-h": "3rem" } as CSSProperties}
    >
      <Header className="px-2 sticky top-0 z-50" />
      <div className="container mx-auto py-2 px-2">{children}</div>
    </div>
  );
}
