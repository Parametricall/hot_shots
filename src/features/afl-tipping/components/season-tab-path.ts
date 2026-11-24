/** A Season's pages. `summary` is the Season summary, which has no tab of its own. */
export type SeasonTab = "summary" | "tips" | "group-tips" | "leaderboard" | "stats";

/** The `to` of a Season's tab, with `$season` to fill in. */
export function seasonTabPath(tab: SeasonTab) {
  return tab === "summary" ? "/afl-tipping/$season" : (`/afl-tipping/$season/${tab}` as const);
}
