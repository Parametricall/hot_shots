import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { SQUIGGLE_SSE_HOST, SQUIGGLE_USER_AGENT } from "./squiggle/constants";
import { SSE_HEARTBEAT_MS, proxyLiveScores, relayWithHeartbeat } from "./sse-proxy";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A stream the test pushes into by hand, and can see being cancelled. */
function controllableStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const cancelled = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel: cancelled,
  });
  return {
    stream,
    cancelled,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
    fail: (error: Error) => controller.error(error),
  };
}

async function readText(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const { value, done } = await reader.read();
  return done ? null : decoder.decode(value);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("relayWithHeartbeat", () => {
  it("passes upstream chunks through unchanged", async () => {
    const upstream = controllableStream();
    const reader = relayWithHeartbeat(upstream.stream).getReader();

    upstream.push("retry:2000\n\n");
    upstream.push("event:score\nid:1\ndata:{}\n\n");

    expect(await readText(reader)).toBe("retry:2000\n\n");
    expect(await readText(reader)).toBe("event:score\nid:1\ndata:{}\n\n");
    await reader.cancel();
  });

  it("sends a heartbeat comment while the upstream is quiet", async () => {
    vi.useFakeTimers();
    const upstream = controllableStream();
    const reader = relayWithHeartbeat(upstream.stream).getReader();

    await vi.advanceTimersByTimeAsync(SSE_HEARTBEAT_MS);
    expect(await readText(reader)).toBe(":hb\n\n");
    await reader.cancel();
  });

  it("closes when the upstream ends, so the browser reconnects", async () => {
    const upstream = controllableStream();
    const reader = relayWithHeartbeat(upstream.stream).getReader();

    upstream.push("data:1\n\n");
    upstream.end();

    expect(await readText(reader)).toBe("data:1\n\n");
    expect(await readText(reader)).toBeNull();
  });

  it("closes when the upstream errors", async () => {
    const upstream = controllableStream();
    const reader = relayWithHeartbeat(upstream.stream).getReader();

    upstream.fail(new Error("upstream reset"));

    expect(await readText(reader)).toBeNull();
  });

  it("cancels the upstream and stops the heartbeat when the client goes away", async () => {
    vi.useFakeTimers();
    const upstream = controllableStream();
    const reader = relayWithHeartbeat(upstream.stream).getReader();

    await reader.cancel("client gone");

    expect(upstream.cancelled).toHaveBeenCalledWith("client gone");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops the heartbeat once the upstream has ended", async () => {
    vi.useFakeTimers();
    const upstream = controllableStream();
    const reader = relayWithHeartbeat(upstream.stream).getReader();

    upstream.end();
    await vi.advanceTimersByTimeAsync(0);
    expect(await readText(reader)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("proxyLiveScores", () => {
  const request = (query = "") => new Request(`http://localhost:3000/api/live-scores${query}`);

  function okFetch() {
    const upstream = controllableStream();
    const fetchImpl = vi.fn().mockResolvedValue(new Response(upstream.stream, { status: 200 }));
    return { fetchImpl: fetchImpl as unknown as typeof fetch, upstream, fetchMock: fetchImpl };
  }

  it("relays the events channel by default, identifying itself to Squiggle", async () => {
    const { fetchImpl, fetchMock, upstream } = okFetch();
    const response = await proxyLiveScores(request(), fetchImpl);

    expect(fetchMock).toHaveBeenCalledWith(
      `${SQUIGGLE_SSE_HOST}/events`,
      expect.objectContaining({
        headers: { "User-Agent": SQUIGGLE_USER_AGENT, Accept: "text/event-stream" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(response.headers.get("x-accel-buffering")).toBe("no");

    upstream.push("data:hello\n\n");
    const reader = response.body!.getReader();
    expect(await readText(reader)).toBe("data:hello\n\n");
    await reader.cancel();
  });

  it("relays the test channel when asked", async () => {
    const { fetchImpl, fetchMock } = okFetch();
    const response = await proxyLiveScores(request("?channel=test"), fetchImpl);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${SQUIGGLE_SSE_HOST}/test`);
    await response.body!.cancel();
  });

  it("passes the request's abort signal upstream", async () => {
    const { fetchImpl, fetchMock } = okFetch();
    const abort = new AbortController();
    const response = await proxyLiveScores(
      new Request("http://localhost:3000/api/live-scores", { signal: abort.signal }),
      fetchImpl,
    );
    expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    await response.body!.cancel();
  });

  it.each(["games", "../events", "events/1", "", "EVENTS"])(
    "rejects the channel %j with 400 and never calls Squiggle",
    async (channel) => {
      const fetchImpl = vi.fn();
      const response = await proxyLiveScores(
        request(`?channel=${encodeURIComponent(channel)}`),
        fetchImpl as unknown as typeof fetch,
      );
      expect(response.status).toBe(400);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("answers 502 when Squiggle refuses", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 403 }));
    const response = await proxyLiveScores(request(), fetchImpl as unknown as typeof fetch);
    expect(response.status).toBe(502);
  });

  it("answers 502 when Squiggle cannot be reached", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const response = await proxyLiveScores(request(), fetchImpl as unknown as typeof fetch);
    expect(response.status).toBe(502);
  });
});
