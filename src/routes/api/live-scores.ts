import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import { proxyLiveScores } from "~/features/afl-tipping/api/sse-proxy";

/**
 * Squiggle's live score stream (SSE), relayed to signed-in Tipsters. The browser
 * cannot reach Squiggle's Event API directly in production: it allowlists origins.
 * EventSource sends same-origin cookies, so the Clerk session reaches this route.
 */
export const Route = createFileRoute("/api/live-scores")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { userId } = await auth();
        if (!userId) return new Response("Unauthorized", { status: 401 });
        return proxyLiveScores(request);
      },
    },
  },
});
