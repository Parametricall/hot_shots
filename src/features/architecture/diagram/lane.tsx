type LaneProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The small uppercase mono label in the lane's corner. */
  label: string;
  /** Not ours: a dashed outline instead of a fill. */
  external?: boolean;
  /** Put the label along the bottom edge, when Boxes and Edges enter from the top. */
  labelAtBottom?: boolean;
};

/** A tinted band behind a group of Boxes, as the overview map's four lanes. */
export const Lane = ({
  x,
  y,
  width,
  height,
  label,
  external = false,
  labelAtBottom = false,
}: LaneProps) => (
  <g>
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={10}
      strokeWidth={1.2}
      className={
        external ? "fill-none stroke-border [stroke-dasharray:6_5]" : "fill-muted stroke-none"
      }
    />
    <text
      x={x + 14}
      y={labelAtBottom ? y + height - 8 : y + 24}
      className="fill-muted-foreground font-mono text-[10.5px] tracking-widest"
    >
      {label}
    </text>
  </g>
);
