import {
  SQUIGGLE_SSE_HOST,
  SQUIGGLE_USER_AGENT,
} from "~/features/afl-tipping/api/squiggle/constants";

/**
 * Squiggle's Event API (SSE) through our own server. Squiggle only allows a
 * short list of browser origins, so the browser reads
 * `/api/live-scores` (src/routes/api/live-scores.ts) and this module relays it.
 * Nothing here imports the session: the route authenticates, this only relays.
 */

/** Idle streams get cut by proxies, so a comment line goes out this often between events. */
export const SSE_HEARTBEAT_MS = 25_000;

/** Only these Squiggle channels may be relayed. Never an arbitrary path. */
export const SSE_CHANNELS = ["events", "test"] as const;
export type SseChannel = (typeof SSE_CHANNELS)[number];

const HEARTBEAT = new TextEncoder().encode(":hb\n\n");

/**
 * Relays `upstream` unchanged (Squiggle's `retry:` and `id:` lines pass through)
 * and adds a heartbeat. When the upstream ends or errors the stream closes, and
 * the browser reconnects on its own. Cancelling it cancels the upstream.
 */
export function relayWithHeartbeat(
  upstream: ReadableStream<Uint8Array>,
  heartbeatMs: number = SSE_HEARTBEAT_MS,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(HEARTBEAT);
        } catch {
          clearInterval(heartbeat);
        }
      }, heartbeatMs);

      void (async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch {
          // Upstream failed or this stream was cancelled: end it either way.
        } finally {
          clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // Already closed by a cancel.
          }
        }
      })();
    },
    async cancel(reason) {
      clearInterval(heartbeat);
      await reader.cancel(reason);
    },
  });
}

const STREAM_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
};

/**
 * The response for `GET /api/live-scores?channel=…`, for a request the route has
 * already authenticated: 400 for a channel that is not allowed, 502 if Squiggle
 * cannot be reached, otherwise the relayed stream. `request.signal` cancels the
 * upstream request when the client goes away.
 */
export async function proxyLiveScores(
  request: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const channel = new URL(request.url).searchParams.get("channel") ?? "events";
  if (!(SSE_CHANNELS as readonly string[]).includes(channel)) {
    return new Response("Unknown channel", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchImpl(`${SQUIGGLE_SSE_HOST}/${channel}`, {
      headers: { "User-Agent": SQUIGGLE_USER_AGENT, Accept: "text/event-stream" },
      signal: request.signal,
    });
  } catch (err) {
    console.warn("[live-scores] upstream fetch failed", err instanceof Error ? err.message : err);
    return new Response("Squiggle is unreachable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    console.warn("[live-scores] upstream refused", { status: upstream.status });
    return new Response("Squiggle refused the connection", { status: 502 });
  }

  return new Response(relayWithHeartbeat(upstream.body), { headers: STREAM_HEADERS });
}
