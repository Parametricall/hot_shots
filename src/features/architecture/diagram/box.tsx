import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type BoxProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The bold first line. */
  title: string;
  /** Up to two sub-lines under the title, in the muted color. */
  lines?: string[];
  /** Set the sub-lines in the mono font, for paths and identifiers. */
  mono?: boolean;
  /** Center the text on the box, as the sequence diagrams' header boxes do. */
  centered?: boolean;
  /** Something that isn't ours, such as Squiggle: a dashed outline. */
  external?: boolean;
  /** Tinted fill, for a box that stands out (the reference's `soft`). */
  soft?: boolean;
  /** The Topic being read: a primary outline. The overview map turns it on per node. */
  highlighted?: boolean;
  className?: string;
  children?: ReactNode;
};

const TEXT_INSET = 12;

/**
 * A rounded rect with a title and up to two sub-lines. Wrap it in `<a className="group/node">`
 * (or a router `Link` with that class) to make it a link: it then shows hover and keyboard focus
 * on the outline. With no lines, the title sits on the box's middle.
 */
export const Box = ({
  x,
  y,
  width,
  height,
  title,
  lines,
  mono = false,
  centered = false,
  external = false,
  soft = false,
  highlighted = false,
  className,
  children,
}: BoxProps) => {
  const textX = centered ? x + width / 2 : x + TEXT_INSET;
  const anchor = centered ? "middle" : "start";
  const titleY = lines ? y + 22 : y + height / 2 + 4.5;

  return (
    <g className={className}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        strokeWidth={highlighted ? 2 : 1.2}
        data-highlighted={highlighted || undefined}
        className={cn(
          "fill-card stroke-border transition-colors",
          "group-hover/node:stroke-primary group-focus-visible/node:stroke-primary",
          external && "stroke-muted-foreground [stroke-dasharray:5_4]",
          soft && "fill-primary/10 stroke-primary",
          highlighted && "fill-primary/10 stroke-primary",
        )}
      />
      <text x={textX} y={titleY} textAnchor={anchor} className="fill-foreground font-semibold">
        {title}
      </text>
      {lines?.map((line, i) => (
        <text
          key={line}
          x={textX}
          y={y + 41 + i * 16}
          textAnchor={anchor}
          className={cn("fill-muted-foreground text-[11px]", mono && "font-mono text-[10.5px]")}
        >
          {line}
        </text>
      ))}
      {children}
    </g>
  );
};
