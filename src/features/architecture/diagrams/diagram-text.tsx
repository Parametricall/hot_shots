import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type DiagramTextProps = {
  x: number;
  y: number;
  /** `title` is bold, `sub` is muted and small, `mono` is a small identifier. Plain by default. */
  variant?: "plain" | "title" | "sub" | "mono";
  anchor?: "start" | "middle" | "end";
  className?: string;
  children: ReactNode;
};

const VARIANT = {
  plain: "",
  title: "font-semibold",
  sub: "fill-muted-foreground text-[11px]",
  mono: "font-mono text-[11px]",
} as const;

/** Free text in a diagram, for the lines a Box can't carry: step notes, axis labels, titles. */
export const DiagramText = ({
  x,
  y,
  variant = "plain",
  anchor = "start",
  className,
  children,
}: DiagramTextProps) => (
  <text x={x} y={y} textAnchor={anchor} className={cn(VARIANT[variant], className)}>
    {children}
  </text>
);
