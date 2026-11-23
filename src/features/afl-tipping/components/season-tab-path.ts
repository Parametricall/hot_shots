export type SeasonTab = "summary" | "tips" | "group-tips" | "standings" | "stats";

/** The `to` of a Season's tab, with `$season` to fill in. */
export function seasonTabPath(tab: SeasonTab) {
  return tab === "summary" ? "/afl-tipping/$season" : (`/afl-tipping/$season/${tab}` as const);
}
