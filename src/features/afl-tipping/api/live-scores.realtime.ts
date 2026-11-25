import { RealtimeClient } from "@supabase/realtime-js";
import * as z from "zod";
import type { LiveScoresService, LiveScoresSubscription } from "~/app/service-registry";
import type { LiveGameUpdate } from "~/features/afl-tipping/api/squiggle/sse-schemas";
import { getRealtimeToken, type RealtimeTokenResult } from "~/features/auth/api/realtime-token";

/**
 * Live Game updates in the browser, from Supabase Realtime (plan 015, D4 and D5). The live ingest
 * writes each change to `afl_games`; a trigger broadcasts it on the private channel
 * `afl:live-games`; this service listens. Only signed-in people may join, so it needs the
 * session's short-lived access token from `getRealtimeToken`. The browser never imports
 * supabase-js or auth-js: it holds the token the server gave it, nothing more.
 *
 * Lifecycle, driven by the subscriber count:
 * - First subscriber: fetch a token (none means signed out: join nothing and stay quiet), set it
 *   on a `RealtimeClient`, join the channel.
 * - About 5 minutes before the token expires: fetch a new one and `setAuth` it. Doing it before
 *   expiry keeps the channel; after expiry the server closes the channel and `setAuth` does not
 *   revive it.
 * - `CLOSED`, `TIMED_OUT` or `CHANNEL_ERROR` while subscribers remain: remove the channel (the
 *   client would otherwise keep retrying with a stale token), wait (2 s, doubling to 60 s), fetch a
 *   fresh token, join a new channel, and tell every subscriber to resync once it is `SUBSCRIBED`.
 *   If the fresh token fetch says signed out, stop retrying.
 * - Last unsubscribe: clear the timers, remove the channel, disconnect.
 *
 * Nothing happens on the server or where `WebSocket` is missing.
 */

export const LIVE_SCORES_TOPIC = "afl:live-games";
export const LIVE_SCORES_EVENT = "live-game";
export const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 10 * 1000;
const REFRESH_RETRY_MS = 30 * 1000;
const INITIAL_BACKOFF_MS = 2 * 1000;
const MAX_BACKOFF_MS = 60 * 1000;

type ChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

/** The slice of realtime-js's `RealtimeChannel` this service uses. */
export type RealtimeChannelLike = {
  on: (
    type: "broadcast",
    filter: { event: string },
    callback: (message: { payload: unknown }) => void,
  ) => RealtimeChannelLike;
  subscribe: (callback: (status: ChannelStatus) => void) => RealtimeChannelLike;
};

/** The slice of realtime-js's `RealtimeClient` this service uses. */
export type RealtimeClientLike = {
  setAuth: (token: string) => Promise<void> | void;
  channel: (topic: string, options: { config: { private: boolean } }) => RealtimeChannelLike;
  removeChannel: (channel: RealtimeChannelLike) => Promise<unknown>;
  disconnect: () => Promise<unknown> | void;
};

export type RealtimeLiveScoresDeps = {
  /** The Supabase URL (public). Without it the service does nothing. */
  url: string | undefined;
  createClient: (url: string, publishableKey: string) => RealtimeClientLike;
  getToken: () => Promise<RealtimeTokenResult>;
};

const payloadSchema = z.object({
  gameId: z.number(),
  homeScore: z.number().nullish(),
  awayScore: z.number().nullish(),
  timeStr: z.string().nullish(),
  complete: z.number().nullish(),
  winnerTeamId: z.number().nullish(),
});

/**
 * The broadcast is the Game's whole live state. A missing score or winner is a real `null`, but
 * the Game's time string and completion have no null, so those are left out when absent.
 */
function parsePayload(payload: unknown): LiveGameUpdate | null {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[live-scores] dropped an invalid live-game payload", parsed.error.message);
    return null;
  }
  const { gameId, homeScore, awayScore, timeStr, complete, winnerTeamId } = parsed.data;
  return {
    gameId,
    ...(homeScore !== undefined && { homeScore }),
    ...(awayScore !== undefined && { awayScore }),
    ...(timeStr != null && { timeStr }),
    ...(complete != null && { complete }),
    ...(winnerTeamId !== undefined && { winnerTeamId }),
  };
}

export function createRealtimeLiveScoresService(deps: RealtimeLiveScoresDeps): LiveScoresService {
  const subscribers = new Set<LiveScoresSubscription>();
  let client: RealtimeClientLike | undefined;
  let channel: RealtimeChannelLike | undefined;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let rejoinTimer: ReturnType<typeof setTimeout> | undefined;
  let backoffMs = INITIAL_BACKOFF_MS;
  let needsResync = false;
  // Bumped on every start and stop, so a token fetch or timer from an earlier run is ignored.
  let run = 0;
  let running = false;

  function fanOut(update: LiveGameUpdate) {
    for (const subscriber of [...subscribers]) subscriber.onUpdate(update);
  }

  function dropChannel() {
    const old = channel;
    channel = undefined;
    // The channel is forgotten first, so the `CLOSED` its removal causes is ignored.
    if (old) void Promise.resolve(client?.removeChannel(old)).catch(() => {});
  }

  function clearTimers() {
    clearTimeout(refreshTimer);
    clearTimeout(rejoinTimer);
    refreshTimer = undefined;
    rejoinTimer = undefined;
  }

  function scheduleRefresh(expiresAt: number, thisRun: number) {
    clearTimeout(refreshTimer);
    const delay = Math.max(expiresAt - REFRESH_BEFORE_EXPIRY_MS - Date.now(), MIN_REFRESH_DELAY_MS);
    refreshTimer = setTimeout(() => void refresh(thisRun), delay);
  }

  async function refresh(thisRun: number) {
    try {
      const result = await deps.getToken();
      if (thisRun !== run) return;
      if (result.ok) {
        await client?.setAuth(result.accessToken);
        if (thisRun !== run) return;
        scheduleRefresh(result.expiresAt, thisRun);
      } else if (result.reason === "unauthenticated") {
        // Signed out meanwhile: the channel closes at expiry anyway, so end it now.
        clearTimers();
        dropChannel();
      } else {
        refreshTimer = setTimeout(() => void refresh(thisRun), REFRESH_RETRY_MS);
      }
    } catch {
      if (thisRun !== run) return;
      refreshTimer = setTimeout(() => void refresh(thisRun), REFRESH_RETRY_MS);
    }
  }

  function scheduleRejoin(thisRun: number) {
    clearTimeout(rejoinTimer);
    const delay = backoffMs;
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    rejoinTimer = setTimeout(() => void join(thisRun), delay);
  }

  function onStatus(status: ChannelStatus, joined: RealtimeChannelLike, thisRun: number) {
    if (thisRun !== run || joined !== channel) return;
    if (status === "SUBSCRIBED") {
      backoffMs = INITIAL_BACKOFF_MS;
      if (needsResync) {
        needsResync = false;
        for (const subscriber of [...subscribers]) subscriber.onResync();
      }
      return;
    }
    // CLOSED, TIMED_OUT or CHANNEL_ERROR. Updates may be missed from here until the next join.
    needsResync = true;
    clearTimeout(refreshTimer);
    dropChannel();
    scheduleRejoin(thisRun);
  }

  async function join(thisRun: number) {
    try {
      const result = await deps.getToken();
      if (thisRun !== run) return;
      // Signed out (or not set up): nothing to join, and nothing to retry until someone signs in
      // and a component subscribes again.
      if (!result.ok) {
        if (result.reason !== "unauthenticated") scheduleRejoin(thisRun);
        return;
      }
      client ??= deps.createClient(deps.url!, result.publishableKey);
      await client.setAuth(result.accessToken);
      if (thisRun !== run) return;

      const joined: RealtimeChannelLike = client.channel(LIVE_SCORES_TOPIC, {
        config: { private: true },
      });
      channel = joined;
      joined
        .on("broadcast", { event: LIVE_SCORES_EVENT }, (message) => {
          if (joined !== channel) return;
          const update = parsePayload(message.payload);
          if (update) fanOut(update);
        })
        .subscribe((status) => onStatus(status, joined, thisRun));
      scheduleRefresh(result.expiresAt, thisRun);
    } catch (err) {
      if (thisRun !== run) return;
      console.warn("[live-scores] could not join", err instanceof Error ? err.message : err);
      dropChannel();
      scheduleRejoin(thisRun);
    }
  }

  function start() {
    running = true;
    run += 1;
    backoffMs = INITIAL_BACKOFF_MS;
    needsResync = false;
    void join(run);
  }

  function stop() {
    running = false;
    run += 1;
    clearTimers();
    dropChannel();
    const old = client;
    client = undefined;
    if (old) void Promise.resolve(old.disconnect()).catch(() => {});
  }

  return {
    subscribe(subscription) {
      // On the server, or where WebSocket does not exist, there is nothing to open.
      if (typeof window === "undefined" || typeof WebSocket === "undefined" || !deps.url) {
        return () => {};
      }

      subscribers.add(subscription);
      if (!running) start();

      return () => {
        if (!subscribers.delete(subscription)) return;
        if (subscribers.size === 0) stop();
      };
    },
  };
}

export const service = createRealtimeLiveScoresService({
  url: import.meta.env.VITE_SUPABASE_URL,
  createClient: (url, publishableKey) =>
    new RealtimeClient(`${url}/realtime/v1`, {
      params: { apikey: publishableKey },
    }) as unknown as RealtimeClientLike,
  getToken: () => getRealtimeToken(),
});
