import { useMarkerIds } from "~/features/architecture/diagram/diagram-context";
import { cn } from "~/lib/utils";

type EdgeShape =
  | { x1: number; y1: number; x2: number; y2: number; d?: never }
  | { d: string; x1?: never; y1?: never; x2?: never; y2?: never };

type EdgeProps = EdgeShape & {
  /** A return: dashed, drawn back along the call it answers. */
  ret?: boolean;
  /** A path the security diagram shows being refused: dashed, in the destructive color. */
  refused?: boolean;
  /** A head at both ends. */
  both?: boolean;
  /** Part of the Topic being read: primary color, a little heavier. A refused Edge keeps its color. */
  highlighted?: boolean;
  className?: string;
};

/**
 * An arrow: a straight `<line>` from (x1, y1) to (x2, y2), or a `<path>` from `d`. Its head
 * points at the end, so draw a return from the callee back to the caller. Must be inside a
 * `Diagram`, which supplies the arrowhead markers.
 */
export const Edge = ({
  ret = false,
  refused = false,
  both = false,
  highlighted = false,
  className,
  ...shape
}: EdgeProps) => {
  const ids = useMarkerIds();
  const markerId = refused ? ids.refused : highlighted ? ids.highlighted : ids.normal;
  const marker = `url(#${markerId})`;
  const common = {
    className: cn(
      "fill-none stroke-muted-foreground transition-colors",
      ret && "[stroke-dasharray:5_4]",
      highlighted && "stroke-primary",
      refused && "stroke-destructive [stroke-dasharray:4_4]",
      className,
    ),
    strokeWidth: highlighted && !refused ? 2 : 1.4,
    markerEnd: marker,
    markerStart: both ? marker : undefined,
    "data-highlighted": highlighted || undefined,
  };

  return shape.d === undefined ? (
    <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...common} />
  ) : (
    <path d={shape.d} {...common} />
  );
};
