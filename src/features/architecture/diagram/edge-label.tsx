import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type EdgeLabelProps = {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  /** What the label sits on, so its halo matches: the page, a lane or a card. */
  on?: "background" | "lane" | "card";
  className?: string;
  children: ReactNode;
};

const HALO = {
  background: "stroke-background",
  lane: "stroke-muted",
  card: "stroke-card",
} as const;

/** Text on an Edge. A halo in the surface's color keeps the line from striking through it. */
export const EdgeLabel = ({
  x,
  y,
  anchor = "start",
  on = "background",
  className,
  children,
}: EdgeLabelProps) => (
  <text
    x={x}
    y={y}
    textAnchor={anchor}
    strokeWidth={4}
    className={cn(
      "fill-muted-foreground text-[11px] [paint-order:stroke] [stroke-linejoin:round]",
      HALO[on],
      className,
    )}
  >
    {children}
  </text>
);
