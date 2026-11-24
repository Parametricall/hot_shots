import { useRouterState } from "@tanstack/react-router";
import type { SeasonTab } from "~/features/afl-tipping/components/season-tab-path";

/** The Season's tab the URL is on (`/afl-tipping/2027/stats`), or `summary` with no tab. */
export function useSeasonTab(): SeasonTab {
  return useRouterState({
    select: (state) => (state.location.pathname.split("/")[3] ?? "summary") as SeasonTab,
  });
}
