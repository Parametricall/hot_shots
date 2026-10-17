// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { LIVE_SCORES_URL, createLiveScoresService } from "./live-scores.service";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 1;
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  listeners = new Map<string, ((event: MessageEvent<string>) => void)[]>();
  close = vi.fn(() => {
    this.readyState = 2;
  });

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(name: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }

  emit(name: string, data: unknown) {
    const event = { data: typeof data === "string" ? data : JSON.stringify(data) };
    for (const listener of this.listeners.get(name) ?? []) {
      listener(event as MessageEvent<string>);
    }
  }
}

const subscription = () => ({ onUpdate: vi.fn(), onResync: vi.fn() });

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("liveScoresService", () => {
  it("opens one EventSource on the proxy route for the first subscriber", () => {
    const service = createLiveScoresService();
    service.subscribe(subscription());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]!.url).toBe(LIVE_SCORES_URL);
    expect(LIVE_SCORES_URL).toBe("/api/live-scores?channel=events");
  });

  it("shares the connection between subscribers and closes it with the last one", () => {
    const service = createLiveScoresService();
    const unsubscribeA = service.subscribe(subscription());
    const unsubscribeB = service.subscribe(subscription());
    expect(FakeEventSource.instances).toHaveLength(1);

    unsubscribeA();
    expect(FakeEventSource.instances[0]!.close).not.toHaveBeenCalled();
    unsubscribeB();
    expect(FakeEventSource.instances[0]!.close).toHaveBeenCalledTimes(1);
  });

  it("ignores a second unsubscribe", () => {
    const service = createLiveScoresService();
    const unsubscribeA = service.subscribe(subscription());
    const unsubscribeB = service.subscribe(subscription());
    unsubscribeA();
    unsubscribeA();
    expect(FakeEventSource.instances[0]!.close).not.toHaveBeenCalled();
    unsubscribeB();
  });

  it("opens a fresh connection when someone subscribes after it closed", () => {
    const service = createLiveScoresService();
    service.subscribe(subscription())();
    service.subscribe(subscription());
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("listens for each named Squiggle event", () => {
    const service = createLiveScoresService();
    service.subscribe(subscription());
    expect([...FakeEventSource.instances[0]!.listeners.keys()].sort()).toEqual([
      "complete",
      "game",
      "score",
      "timestr",
      "winner",
    ]);
  });

  it("parses events and fans the updates out to every subscriber", () => {
    const service = createLiveScoresService();
    const a = subscription();
    const b = subscription();
    service.subscribe(a);
    service.subscribe(b);

    FakeEventSource.instances[0]!.emit("complete", { gameid: 7, complete: 100 });

    expect(a.onUpdate).toHaveBeenCalledWith({ gameId: 7, complete: 100 });
    expect(b.onUpdate).toHaveBeenCalledWith({ gameId: 7, complete: 100 });
  });

  it("drops an event it cannot parse", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const service = createLiveScoresService();
    const sub = subscription();
    service.subscribe(sub);

    FakeEventSource.instances[0]!.emit("timestr", "{nope");

    expect(sub.onUpdate).not.toHaveBeenCalled();
  });

  it("stops sending updates to a subscriber that left", () => {
    const service = createLiveScoresService();
    const a = subscription();
    const b = subscription();
    const unsubscribeA = service.subscribe(a);
    service.subscribe(b);
    unsubscribeA();

    FakeEventSource.instances[0]!.emit("complete", { gameid: 7, complete: 100 });

    expect(a.onUpdate).not.toHaveBeenCalled();
    expect(b.onUpdate).toHaveBeenCalledTimes(1);
  });

  it("asks for a resync when the connection reopens after an error, not on the first open", () => {
    const service = createLiveScoresService();
    const sub = subscription();
    service.subscribe(sub);
    const source = FakeEventSource.instances[0]!;

    source.onopen?.(new Event("open"));
    expect(sub.onResync).not.toHaveBeenCalled();

    source.onerror?.(new Event("error"));
    source.onopen?.(new Event("open"));
    expect(sub.onResync).toHaveBeenCalledTimes(1);

    source.onopen?.(new Event("open"));
    expect(sub.onResync).toHaveBeenCalledTimes(1);
  });

  it("opens a fresh connection for the next subscriber after a terminal error", () => {
    const service = createLiveScoresService();
    service.subscribe(subscription());
    const dead = FakeEventSource.instances[0]!;
    dead.readyState = 2; // the browser gave up, say on a 401
    dead.onerror?.(new Event("error"));

    service.subscribe(subscription());

    expect(FakeEventSource.instances).toHaveLength(2);
  });
});

describe("liveScoresService where there is no EventSource", () => {
  it("does nothing and returns a no-op unsubscribe", () => {
    vi.stubGlobal("EventSource", undefined);
    const service = createLiveScoresService();
    const unsubscribe = service.subscribe(subscription());
    expect(FakeEventSource.instances).toHaveLength(0);
    expect(() => unsubscribe()).not.toThrow();
  });
});
