import { getRouteApi } from "@tanstack/react-router";

const seasonRoute = getRouteApi("/_authenticated/afl-tipping/$season");

/**
 * The Season the page is showing, from the URL (`/afl-tipping/2027/tips`). Components read it here
 * and never take it as a prop passed down several levels.
 */
export function useSeason(): number {
  return seasonRoute.useParams({ select: (params) => params.season });
}
