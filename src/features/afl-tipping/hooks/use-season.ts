import { useSuspenseQuery } from "@tanstack/react-query";
import { aflQueries } from "~/features/afl-tipping/api/queries";

/**
 * The Season the page is showing. Components read it here and never take it as a prop several
 * levels down. Until the routes carry the Season in their path, it is the Current Season.
 */
export function useSeason(): number {
  const { data } = useSuspenseQuery(aflQueries.seasons());
  return data.current.season;
}
