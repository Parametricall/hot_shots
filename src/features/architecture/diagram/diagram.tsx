import { useId, useMemo, type ReactNode } from "react";
import { Arrowheads } from "~/features/architecture/diagram/arrowheads";
import { MarkerIdsContext, type MarkerIds } from "~/features/architecture/diagram/diagram-context";

type DiagramProps = {
  /** The reference's viewBox, such as "0 0 1000 680". */
  viewBox: string;
  /** What the diagram shows, for screen readers. */
  label: string;
  /** Narrower than this and the diagram scrolls sideways instead of shrinking. */
  minWidth?: number;
  /** Wider than this and the diagram stops growing. */
  maxWidth?: number;
  children: ReactNode;
};

/**
 * The shell every diagram shares: an `overflow-x-auto` wrapper around an SVG that keeps the
 * reference's `viewBox`, so a phone scrolls the diagram rather than shrinking it past legibility.
 * It also owns the arrowhead markers. Their ids come from `useId()`, so two diagrams on one page
 * can't clash, and reach each Edge through context.
 */
export const Diagram = ({ viewBox, label, minWidth = 640, maxWidth, children }: DiagramProps) => {
  const id = useId().replace(/:/g, "");
  const ids = useMemo<MarkerIds>(
    () => ({ normal: `${id}-ah`, highlighted: `${id}-ah-hot`, refused: `${id}-ah-no` }),
    [id],
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={viewBox}
        role="img"
        aria-label={label}
        className="block h-auto w-full fill-foreground font-sans text-[13px]"
        style={{ minWidth, maxWidth }}
      >
        <Arrowheads ids={ids} />
        <MarkerIdsContext.Provider value={ids}>{children}</MarkerIdsContext.Provider>
      </svg>
    </div>
  );
};
