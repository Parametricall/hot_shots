import { createFileRoute, redirect } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { landingFor } from "~/features/afl-tipping/utils/afl-season";
import { now } from "~/lib/clock";

// Opening the App lands on My Tips while a Season is under way or about to start, and on the Season
// summary in the Pre-season and once it is over (`landingFor`). A warm cache (the persisted one, in the installed app) answers without waiting on the
// network. With nothing cached and Squiggle down, this throws, and the route's error component
// offers a retry: no guessing a Season.
export const Route = createFileRoute("/_authenticated/afl-tipping/")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const { current } = await queryClient.ensureQueryData(aflQueries.seasons());
    const landing = landingFor(current, now());
    if (landing.to === "summary") {
      throw redirect({
        to: "/afl-tipping/$season",
        params: { season: landing.season },
        replace: true,
      });
    }
    throw redirect({
      to: "/afl-tipping/$season/tips",
      params: { season: landing.season },
      replace: true,
    });
  },
});
