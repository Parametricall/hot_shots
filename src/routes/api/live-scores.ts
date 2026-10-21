import { createFileRoute } from "@tanstack/react-router";
import { getSessionUserId } from "~/features/auth/api/session";
import { proxyLiveScores } from "~/features/afl-tipping/api/sse-proxy";

/**
 * Squiggle's live score stream (SSE), relayed to signed-in Tipsters. The browser
 * cannot reach Squiggle's Event API directly in production: it allowlists origins.
 * EventSource sends same-origin cookies, so the session cookie reaches this route. It needs a signed-in Profile, not a Tipster.
 */
export const Route = createFileRoute("/api/live-scores")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getSessionUserId();
        if (!userId) return new Response("Unauthorized", { status: 401 });
        return proxyLiveScores(request);
      },
    },
  },
});
