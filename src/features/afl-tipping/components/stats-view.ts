/** The Stats page's two segments: Tipster stats, and the AFL Ladder. */
export const STATS_VIEWS = ["tipsters", "ladder"] as const;

export type StatsView = (typeof STATS_VIEWS)[number];
