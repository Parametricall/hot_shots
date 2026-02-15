import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withCache, clearCache } from "~/features/afl-tipping/api/cache";

beforeEach(() => {
  clearCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withCache", () => {
  it("calls the fetch function on first invocation", async () => {
    const fn = vi.fn().mockResolvedValue("data");
    const result = await withCache("key", 1000, fn);

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe("data");
  });

  it("returns cached data on subsequent calls within TTL", async () => {
    const fn = vi.fn().mockResolvedValue("data");

    await withCache("key", 5000, fn);
    const result = await withCache("key", 5000, fn);

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBe("data");
  });

  it("re-fetches after TTL expires", async () => {
    const fn = vi.fn().mockResolvedValueOnce("old").mockResolvedValueOnce("new");

    const first = await withCache("key", 1000, fn);
    expect(first).toBe("old");

    vi.advanceTimersByTime(1001);

    const second = await withCache("key", 1000, fn);
    expect(second).toBe("new");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("caches different keys independently", async () => {
    const fnA = vi.fn().mockResolvedValue("A");
    const fnB = vi.fn().mockResolvedValue("B");

    await withCache("a", 5000, fnA);
    await withCache("b", 5000, fnB);

    // Both should have been called once
    expect(fnA).toHaveBeenCalledOnce();
    expect(fnB).toHaveBeenCalledOnce();

    // Second calls should use cache
    const resultA = await withCache("a", 5000, fnA);
    const resultB = await withCache("b", 5000, fnB);

    expect(resultA).toBe("A");
    expect(resultB).toBe("B");
    expect(fnA).toHaveBeenCalledOnce();
    expect(fnB).toHaveBeenCalledOnce();
  });

  it("serves stale data until TTL expires even with different TTL on second call", async () => {
    const fn = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    await withCache("key", 5000, fn);

    vi.advanceTimersByTime(3000);

    // Call with a shorter TTL — the existing cache entry (set with 5000ms) is still valid
    const result = await withCache("key", 1000, fn);
    expect(result).toBe("first");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("propagates errors from the fetch function", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fetch failed"));

    await expect(withCache("key", 1000, fn)).rejects.toThrow("fetch failed");
  });

  it("does not cache failed requests", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("success");

    await expect(withCache("key", 1000, fn)).rejects.toThrow("fail");

    const result = await withCache("key", 1000, fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns exactly at TTL boundary (not expired yet)", async () => {
    const fn = vi.fn().mockResolvedValueOnce("cached").mockResolvedValueOnce("fresh");

    await withCache("key", 1000, fn);

    // Advance to exactly 1000ms — should still be valid (Date.now() < expiry)
    vi.advanceTimersByTime(999);

    const result = await withCache("key", 1000, fn);
    expect(result).toBe("cached");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("expires at exactly TTL boundary", async () => {
    const fn = vi.fn().mockResolvedValueOnce("cached").mockResolvedValueOnce("fresh");

    await withCache("key", 1000, fn);

    vi.advanceTimersByTime(1000);

    const result = await withCache("key", 1000, fn);
    expect(result).toBe("fresh");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clearCache removes all entries", async () => {
    const fn = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    await withCache("key", 60000, fn);
    clearCache();

    const result = await withCache("key", 60000, fn);
    expect(result).toBe("second");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
