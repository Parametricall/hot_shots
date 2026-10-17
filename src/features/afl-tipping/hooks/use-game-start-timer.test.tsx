import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { clearDemoNow, setDemoNow } from "~/lib/clock";
import { useGameStartTimer } from "./use-game-start-timer";

const START = new Date("2026-06-04T09:00:00Z").getTime();
const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START - HOUR);
});

afterEach(() => {
  clearDemoNow();
  vi.useRealTimers();
});

describe("useGameStartTimer on the real clock", () => {
  it("locks the Game when the start time arrives", () => {
    const { result } = renderHook(() => useGameStartTimer(START));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(HOUR);
    });
    expect(result.current).toBe(true);
  });

  it("is already started for a Game in the past", () => {
    const { result } = renderHook(() => useGameStartTimer(START - 2 * HOUR));
    expect(result.current).toBe(true);
  });

  it("re-checks the clock when the timer fires, and only then locks", () => {
    const { result } = renderHook(() => useGameStartTimer(START));
    // The clock steps back after the timer was set, so the timer fires too soon.
    vi.setSystemTime(START - 2 * HOUR);
    act(() => {
      vi.advanceTimersByTime(HOUR);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(HOUR);
    });
    expect(result.current).toBe(true);
  });
});

describe("useGameStartTimer with the Demo clock", () => {
  it("is started once the Demo clock reaches the start, with no timers", () => {
    setDemoNow(START + HOUR);
    const { result } = renderHook(() => useGameStartTimer(START));
    expect(result.current).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start as real time passes", () => {
    setDemoNow(START - HOUR);
    const { result } = renderHook(() => useGameStartTimer(START));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(48 * HOUR);
    });
    expect(result.current).toBe(false);
  });

  it("follows the Demo clock back and forth", () => {
    setDemoNow(START - HOUR);
    const { result } = renderHook(() => useGameStartTimer(START));
    expect(result.current).toBe(false);

    act(() => setDemoNow(START + HOUR));
    expect(result.current).toBe(true);

    act(() => setDemoNow(START - HOUR));
    expect(result.current).toBe(false);
  });
});
