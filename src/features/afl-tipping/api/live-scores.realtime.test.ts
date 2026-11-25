// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { RealtimeTokenResult } from "~/features/auth/api/realtime-token";
import {
  LIVE_SCORES_EVENT,
  LIVE_SCORES_TOPIC,
  REFRESH_BEFORE_EXPIRY_MS,
  createRealtimeLiveScoresService,
  type RealtimeChannelLike,
  type RealtimeClientLike,
} from "./live-scores.realtime";

type Status = "SUBSCRIBED" | "CLOSED" | "TIMED_OUT" | "CHANNEL_ERROR";

class FakeChannel implements RealtimeChannelLike {
  statusCallback: ((status: Status) => void) | undefined;
  broadcastCallback: ((message: { payload: unknown }) => void) | undefined;
  filter: unknown;
  constructor(
    readonly topic: string,
    readonly options: unknown,
  ) {}
  on(_type: "broadcast", filter: { event: string }, callback: (m: { payload: unknown }) => void) {
    this.filter = filter;
    this.broadcastCallback = callback;
    return this;
  }
  subscribe(callback: (status: Status) => void) {
    this.statusCallback = callback;
    return this;
  }
  status(status: Status) {
    this.statusCallback?.(status);
  }
  emit(payload: unknown) {
    this.broadcastCallback?.({ payload });
  }
}

class FakeClient implements RealtimeClientLike {
  channels: FakeChannel[] = [];
  setAuth = vi.fn(async (_token: string) => {});
  removeChannel = vi.fn(async (_channel: RealtimeChannelLike) => "ok");
  disconnect = vi.fn(async () => "ok");
  channel(topic: string, options: unknown) {
    const channel = new FakeChannel(topic, options);
    this.channels.push(channel);
    return channel;
  }
}

const NOW = new Date("2027-04-01T00:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;
const token = (name: string, lifetimeMs = HOUR): RealtimeTokenResult => ({
  ok: true,
  accessToken: name,
  expiresAt: NOW + lifetimeMs,
  publishableKey: "sb_publishable_test",
});

const subscription = () => ({ onUpdate: vi.fn(), onResync: vi.fn() });

let clients: FakeClient[];
let getToken: ReturnType<typeof vi.fn<() => Promise<RealtimeTokenResult>>>;
let createClient: ReturnType<typeof vi.fn<(url: string, key: string) => RealtimeClientLike>>;

function build() {
  return createRealtimeLiveScoresService({
    url: "http://127.0.0.1:55321",
    createClient,
    getToken,
  });
}

/** The channel the service most recently joined. */
const lastChannel = () => clients[0]!.channels.at(-1)!;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  vi.stubGlobal("WebSocket", class {});
  clients = [];
  getToken = vi.fn(async () => token("t1"));
  createClient = vi.fn((_url: string, _key: string) => {
    const client = new FakeClient();
    clients.push(client);
    return client;
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("realtime live scores service", () => {
  it("joins one private channel for the first subscriber, with the token set first", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();

    expect(createClient).toHaveBeenCalledWith("http://127.0.0.1:55321", "sb_publishable_test");
    expect(clients[0]!.setAuth).toHaveBeenCalledWith("t1");
    expect(clients[0]!.channels).toHaveLength(1);
    expect(lastChannel().topic).toBe(LIVE_SCORES_TOPIC);
    expect(lastChannel().topic).toBe("afl:live-games");
    expect(lastChannel().options).toEqual({ config: { private: true } });
    expect(lastChannel().filter).toEqual({ event: LIVE_SCORES_EVENT });
    expect(LIVE_SCORES_EVENT).toBe("live-game");
  });

  it("shares the channel between subscribers and tears down with the last one", async () => {
    const service = build();
    const unsubscribeA = service.subscribe(subscription());
    const unsubscribeB = service.subscribe(subscription());
    await flush();
    expect(clients).toHaveLength(1);
    expect(clients[0]!.channels).toHaveLength(1);

    unsubscribeA();
    expect(clients[0]!.removeChannel).not.toHaveBeenCalled();
    unsubscribeB();
    expect(clients[0]!.removeChannel).toHaveBeenCalledWith(lastChannel());
    expect(clients[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it("ignores a second unsubscribe", async () => {
    const service = build();
    const unsubscribeA = service.subscribe(subscription());
    const unsubscribeB = service.subscribe(subscription());
    await flush();
    unsubscribeA();
    unsubscribeA();
    expect(clients[0]!.disconnect).not.toHaveBeenCalled();
    unsubscribeB();
  });

  it("joins afresh when someone subscribes after the last one left", async () => {
    const service = build();
    service.subscribe(subscription())();
    await flush();
    service.subscribe(subscription());
    await flush();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(clients.flatMap((c) => c.channels)).toHaveLength(1);
  });

  it("does not join if the last subscriber left while the token was loading", async () => {
    const service = build();
    service.subscribe(subscription())();
    await flush();
    expect(clients.flatMap((c) => c.channels)).toHaveLength(0);
  });

  it("joins afresh, with a new client, after a full teardown", async () => {
    const service = build();
    const unsubscribe = service.subscribe(subscription());
    await flush();
    unsubscribe();
    service.subscribe(subscription());
    await flush();
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(clients[1]!.channels).toHaveLength(1);
  });

  it("parses payloads and fans the updates out to every subscriber", async () => {
    const service = build();
    const a = subscription();
    const b = subscription();
    service.subscribe(a);
    service.subscribe(b);
    await flush();

    lastChannel().emit({
      id: "x",
      gameId: 7,
      homeScore: 80,
      awayScore: 71,
      timeStr: "Q3 5:00",
      complete: 60,
      winnerTeamId: null,
    });

    const expected = {
      gameId: 7,
      homeScore: 80,
      awayScore: 71,
      timeStr: "Q3 5:00",
      complete: 60,
      winnerTeamId: null,
    };
    expect(a.onUpdate).toHaveBeenCalledWith(expected);
    expect(b.onUpdate).toHaveBeenCalledWith(expected);
  });

  it("leaves out a time string or completion the row does not have", async () => {
    const service = build();
    const sub = subscription();
    service.subscribe(sub);
    await flush();

    lastChannel().emit({ gameId: 7, homeScore: null, awayScore: null, timeStr: null, complete: 0 });

    expect(sub.onUpdate).toHaveBeenCalledWith({
      gameId: 7,
      homeScore: null,
      awayScore: null,
      complete: 0,
    });
  });

  it.each([null, "nope", {}, { gameId: "7" }, { gameId: 7, homeScore: "high" }])(
    "drops an invalid payload (%j)",
    async (payload) => {
      const service = build();
      const sub = subscription();
      service.subscribe(sub);
      await flush();

      lastChannel().emit(payload);

      expect(sub.onUpdate).not.toHaveBeenCalled();
    },
  );

  it("stops sending updates to a subscriber that left", async () => {
    const service = build();
    const a = subscription();
    const b = subscription();
    const unsubscribeA = service.subscribe(a);
    service.subscribe(b);
    await flush();
    unsubscribeA();

    lastChannel().emit({ gameId: 7, complete: 100 });

    expect(a.onUpdate).not.toHaveBeenCalled();
    expect(b.onUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not ask for a resync on the first join", async () => {
    const service = build();
    const sub = subscription();
    service.subscribe(sub);
    await flush();
    lastChannel().status("SUBSCRIBED");
    expect(sub.onResync).not.toHaveBeenCalled();
  });
});

describe("realtime live scores service token handling", () => {
  it("joins nothing when nobody is signed in", async () => {
    getToken.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const service = build();
    const sub = subscription();
    service.subscribe(sub);
    await flush();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(createClient).not.toHaveBeenCalled();
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(sub.onUpdate).not.toHaveBeenCalled();
  });

  it("sets a fresh token before the old one expires, on the same channel", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();
    lastChannel().status("SUBSCRIBED");
    getToken.mockResolvedValue(token("t2", 2 * HOUR));

    await vi.advanceTimersByTimeAsync(HOUR - REFRESH_BEFORE_EXPIRY_MS - 1000);
    expect(getToken).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(clients[0]!.setAuth).toHaveBeenLastCalledWith("t2");
    expect(clients[0]!.channels).toHaveLength(1);
    expect(clients[0]!.removeChannel).not.toHaveBeenCalled();
  });

  it("keeps refreshing: the next refresh is timed from the new expiry", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();
    lastChannel().status("SUBSCRIBED");
    getToken.mockResolvedValue(token("t2", 2 * HOUR));
    await vi.advanceTimersByTimeAsync(HOUR - REFRESH_BEFORE_EXPIRY_MS);
    getToken.mockResolvedValue(token("t3", 3 * HOUR));

    await vi.advanceTimersByTimeAsync(HOUR);

    expect(clients[0]!.setAuth).toHaveBeenLastCalledWith("t3");
  });

  it("removes the channel and stops if the refresh finds no session", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();
    lastChannel().status("SUBSCRIBED");
    const channel = lastChannel();
    getToken.mockResolvedValue({ ok: false, reason: "unauthenticated" });

    await vi.advanceTimersByTimeAsync(HOUR);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    expect(clients[0]!.removeChannel).toHaveBeenCalledWith(channel);
    expect(getToken).toHaveBeenCalledTimes(2);
  });
});

describe("realtime live scores service reconnecting", () => {
  it.each(["CLOSED", "TIMED_OUT", "CHANNEL_ERROR"] as const)(
    "on %s it removes the channel, rejoins with a fresh token and asks for a resync",
    async (status) => {
      const service = build();
      const a = subscription();
      const b = subscription();
      service.subscribe(a);
      service.subscribe(b);
      await flush();
      const first = lastChannel();
      first.status("SUBSCRIBED");
      getToken.mockResolvedValue(token("t2"));

      first.status(status);
      expect(clients[0]!.removeChannel).toHaveBeenCalledWith(first);
      await vi.advanceTimersByTimeAsync(2000);

      expect(clients[0]!.setAuth).toHaveBeenLastCalledWith("t2");
      expect(clients[0]!.channels).toHaveLength(2);
      expect(a.onResync).not.toHaveBeenCalled();

      lastChannel().status("SUBSCRIBED");
      expect(a.onResync).toHaveBeenCalledTimes(1);
      expect(b.onResync).toHaveBeenCalledTimes(1);

      lastChannel().status("SUBSCRIBED");
      expect(a.onResync).toHaveBeenCalledTimes(1);
    },
  );

  it("still delivers updates from the new channel", async () => {
    const service = build();
    const sub = subscription();
    service.subscribe(sub);
    await flush();
    lastChannel().status("CLOSED");
    await vi.advanceTimersByTimeAsync(2000);
    lastChannel().status("SUBSCRIBED");

    lastChannel().emit({ gameId: 7, complete: 100 });

    expect(sub.onUpdate).toHaveBeenCalledTimes(1);
  });

  it("backs off 2 s, 4 s, 8 s and so on up to 60 s while the join keeps failing", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();

    const delays: number[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const before = clients[0]!.channels.length;
      lastChannel().status("CHANNEL_ERROR");
      let waited = 0;
      while (clients[0]!.channels.length === before && waited < 120_000) {
        await vi.advanceTimersByTimeAsync(1000);
        waited += 1000;
      }
      delays.push(waited);
    }

    expect(delays).toEqual([2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  });

  it("resets the backoff once a join succeeds", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();
    lastChannel().status("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(2000);
    lastChannel().status("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(4000);
    lastChannel().status("SUBSCRIBED");

    lastChannel().status("CLOSED");
    await vi.advanceTimersByTimeAsync(2000);

    expect(clients[0]!.channels).toHaveLength(4);
  });

  it("stops retrying when the rejoin finds no session", async () => {
    const service = build();
    const sub = subscription();
    service.subscribe(sub);
    await flush();
    lastChannel().status("CHANNEL_ERROR");
    getToken.mockResolvedValue({ ok: false, reason: "unauthenticated" });

    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(clients[0]!.channels).toHaveLength(1);
    expect(sub.onResync).not.toHaveBeenCalled();
  });

  it("retries with backoff when fetching the token fails", async () => {
    const service = build();
    service.subscribe(subscription());
    await flush();
    lastChannel().status("CLOSED");
    getToken.mockRejectedValueOnce(new Error("offline"));

    await vi.advanceTimersByTimeAsync(2000);
    expect(clients[0]!.channels).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4000);

    expect(getToken).toHaveBeenCalledTimes(3);
    expect(clients[0]!.channels).toHaveLength(2);
  });

  it("does not rejoin after the last subscriber left", async () => {
    const service = build();
    const unsubscribe = service.subscribe(subscription());
    await flush();
    lastChannel().status("CLOSED");
    unsubscribe();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(clients[0]!.channels).toHaveLength(1);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("ignores the close it causes by removing a channel", async () => {
    const service = build();
    const unsubscribe = service.subscribe(subscription());
    await flush();
    const channel = lastChannel();
    unsubscribe();

    channel.status("CLOSED");
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(getToken).toHaveBeenCalledTimes(1);
  });
});

describe("realtime live scores service where it cannot run", () => {
  it("does nothing on the server", async () => {
    vi.stubGlobal("window", undefined);
    const service = build();
    const unsubscribe = service.subscribe(subscription());
    await flush();
    expect(getToken).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("does nothing where there is no WebSocket", async () => {
    vi.stubGlobal("WebSocket", undefined);
    const service = build();
    const unsubscribe = service.subscribe(subscription());
    await flush();
    expect(getToken).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("does nothing with no Supabase URL", async () => {
    const service = createRealtimeLiveScoresService({ url: undefined, createClient, getToken });
    service.subscribe(subscription());
    await flush();
    expect(getToken).not.toHaveBeenCalled();
  });
});
