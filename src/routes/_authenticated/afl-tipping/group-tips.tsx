import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { aflQueries } from "~/features/afl-tipping/api/queries";

// Installed PWAs keep the `start_url` they were installed with, and links are already shared, so
// the URLs from before Seasons stay for good and send on to the Current Season. They match ahead
// of `$season`, because TanStack Router ranks a static segment above a dynamic one.
export const Route = createFileRoute("/_authenticated/afl-tipping/group-tips")({
  validateSearch: z.object({ round: z.number().int().nonnegative().optional() }),
  beforeLoad: async ({ context: { queryClient }, search }) => {
    const { current } = await queryClient.ensureQueryData(aflQueries.seasons());
    throw redirect({
      to: "/afl-tipping/$season/group-tips",
      params: { season: current.season },
      search: { round: search.round },
      replace: true,
    });
  },
});
