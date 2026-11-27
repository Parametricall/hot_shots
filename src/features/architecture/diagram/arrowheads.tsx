import type { MarkerIds } from "~/features/architecture/diagram/diagram-context";

type ArrowheadsProps = { ids: MarkerIds };

/**
 * The `<marker>` defs for one Diagram: a head for each color state of an Edge. Each marker
 * is filled from a shadcn token, so the heads follow the theme like the lines do. `Diagram`
 * renders this with ids from `useId()`; don't render it twice for the same ids.
 */
export const Arrowheads = ({ ids }: ArrowheadsProps) => (
  <defs>
    <Arrowhead id={ids.normal} className="fill-muted-foreground" />
    <Arrowhead id={ids.highlighted} className="fill-primary" size={9} />
    <Arrowhead id={ids.refused} className="fill-destructive" />
  </defs>
);

type ArrowheadProps = { id: string; className: string; size?: number };

const Arrowhead = ({ id, className, size = 8 }: ArrowheadProps) => (
  <marker
    id={id}
    viewBox="0 0 8 8"
    refX={7}
    refY={4}
    markerWidth={size}
    markerHeight={size}
    markerUnits="userSpaceOnUse"
    orient="auto-start-reverse"
  >
    <path d="M0,0 L8,4 L0,8 z" className={className} />
  </marker>
);
