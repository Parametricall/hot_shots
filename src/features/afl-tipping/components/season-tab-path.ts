/**
 * A Season's pages. `summary` is the Season summary and `how-tipping-works` the rules (opened from
 * More); neither has a tab of its own.
 */
export type SeasonTab =
  | "summary"
  | "tips"
  | "group-tips"
  | "leaderboard"
  | "stats"
  | "how-tipping-works";

/** The `to` of a Season's tab, with `$season` to fill in. */
export function seasonTabPath(tab: SeasonTab) {
  return tab === "summary" ? "/afl-tipping/$season" : (`/afl-tipping/$season/${tab}` as const);
}
