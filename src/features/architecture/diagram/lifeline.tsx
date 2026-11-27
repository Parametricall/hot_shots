type LifelineProps = { x: number; y1: number; y2: number };

/** The dashed vertical line under a sequence diagram's participant box. */
export const Lifeline = ({ x, y1, y2 }: LifelineProps) => (
  <line
    x1={x}
    y1={y1}
    x2={x}
    y2={y2}
    strokeWidth={1.2}
    className="stroke-border [stroke-dasharray:3_4]"
  />
);

type ActivationProps = { x: number; y: number; height: number };

/** The narrow bar on a Lifeline while its participant is working. Centered on `x`. */
export const Activation = ({ x, y, height }: ActivationProps) => (
  <rect
    x={x - 6}
    y={y}
    width={12}
    height={height}
    rx={2}
    className="fill-primary/10 stroke-primary"
  />
);
