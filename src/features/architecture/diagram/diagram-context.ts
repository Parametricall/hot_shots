import { createContext, useContext } from "react";

/** The ids of one Diagram's arrowhead markers, one per color state. */
export type MarkerIds = { normal: string; highlighted: string; refused: string };

export const MarkerIdsContext = createContext<MarkerIds | null>(null);

/** Marker ids for the enclosing `Diagram`. Throws outside one, since an Edge can't draw without. */
export const useMarkerIds = (): MarkerIds => {
  const ids = useContext(MarkerIdsContext);
  if (!ids) throw new Error("Edge must be rendered inside a Diagram");
  return ids;
};
