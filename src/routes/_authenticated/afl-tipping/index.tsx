import { createFileRoute, redirect } from "@tanstack/react-router";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import { landingFor } from "~/features/afl-tipping/utils/afl-season";

// Opening the App lands on My Tips while a Season is open, and on the Season summary once it is
// over. A warm cache (the persisted one, in the installed app) answers without waiting on the
// network. With nothing cached and Squiggle down, this throws, and the route's error component
// offers a retry: no guessing a Season.
export const Route = createFileRoute("/_authenticated/afl-tipping/")({
  beforeLoad: async ({ context: { queryClient } }) => {
    const { current } = await queryClient.ensureQueryData(aflQueries.seasons());
    const landing = landingFor(current);
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
