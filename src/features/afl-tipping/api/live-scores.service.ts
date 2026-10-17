import type { LiveScoresService, LiveScoresSubscription } from "~/app/service-registry";
import { SSE_GAME_EVENT_NAMES, parseSseEvent } from "./squiggle/sse-schemas";

/**
 * Live Game updates in the browser: one shared EventSource on our own
 * `/api/live-scores` route, which relays Squiggle's Event API (squiggle's origin
 * allowlist keeps the browser from calling it directly).
 */

export const LIVE_SCORES_URL = "/api/live-scores?channel=events";

const EVENT_SOURCE_CLOSED = 2;

type EventSourceLike = Pick<EventSource, "addEventListener" | "close" | "readyState"> & {
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
};

export function createLiveScoresService(
  createSource: (url: string) => EventSourceLike = (url) => new EventSource(url),
): LiveScoresService {
  const subscribers = new Set<LiveScoresSubscription>();
  let source: EventSourceLike | undefined;
  let reconnecting = false;

  function open() {
    const opened = createSource(LIVE_SCORES_URL);
    source = opened;

    // Named SSE events never reach `onmessage`, so each one needs its own listener.
    for (const eventName of SSE_GAME_EVENT_NAMES) {
      opened.addEventListener(eventName, (event) => {
        const update = parseSseEvent(eventName, (event as MessageEvent<string>).data);
        if (!update) return;
        for (const subscriber of [...subscribers]) subscriber.onUpdate(update);
      });
    }

    // EventSource reconnects by itself after an error (Squiggle's `retry:2000` passes
    // through the proxy). Events may have been missed meanwhile, so the next open
    // after an error asks subscribers to resync.
    opened.onerror = () => {
      reconnecting = true;
      // A terminal error (the browser gave up, say on a 401) leaves a dead source behind.
      // Forget it, so the next subscriber opens a fresh one.
      if (opened.readyState === EVENT_SOURCE_CLOSED && source === opened) source = undefined;
    };
    opened.onopen = () => {
      if (!reconnecting) return;
      reconnecting = false;
      for (const subscriber of [...subscribers]) subscriber.onResync();
    };
  }

  function close() {
    source?.close();
    source = undefined;
    reconnecting = false;
  }

  return {
    subscribe(subscription) {
      // On the server, or where EventSource does not exist, there is nothing to open.
      if (typeof window === "undefined" || typeof EventSource === "undefined") return () => {};

      subscribers.add(subscription);
      if (!source) open();

      return () => {
        if (!subscribers.delete(subscription)) return;
        if (subscribers.size === 0) close();
      };
    },
  };
}

export const service = createLiveScoresService();
