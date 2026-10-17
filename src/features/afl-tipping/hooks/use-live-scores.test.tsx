import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider, skipToken, useQuery, type QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { LiveScoresSubscription } from "~/app/service-registry";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflGame } from "~/features/afl-tipping/types";
import { clearDemoNow, setDemoNow } from "~/lib/clock";
import { createTestQueryClient } from "~/test/render";
import { useLiveScores } from "./use-live-scores";

const { subscribe, unsubscribe, capture } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  const capture: { subscription?: LiveScoresSubscription } = {};
  const subscribe = vi.fn((subscription: LiveScoresSubscription) => {
    capture.subscription = subscription;
    return unsubscribe;
  });
  return { subscribe, unsubscribe, capture };
});

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn((name: string) => (name === "liveScoresService" ? { subscribe } : {})),
  },
}));

const T0 = new Date("2026-06-04T09:00:00Z").getTime();
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function game(id: number, startsInMs: number, overrides: Partial<AflGame> = {}) {
  return createAflGame({
    id,
    unixTime: T0 + startsInMs,
    date: new Date(T0 + startsInMs),
    homeTeamId: id * 10,
    awayTeamId: id * 10 + 1,
    ...overrides,
  });
}

/** Runs the hook over the Games in the query cache, as the page shell does. */
function renderLiveScores(queryClient: QueryClient, games: AflGame[]) {
  queryClient.setQueryData(aflQueries.allGamesKey(), games);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => {
      const { data } = useQuery<AflGame[]>({
        queryKey: aflQueries.allGamesKey(),
        queryFn: skipToken, // the Games are already in the cache
        staleTime: Infinity,
      });
      useLiveScores(data ?? []);
    },
    { wrapper },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  subscribe.mockClear();
  unsubscribe.mockClear();
  capture.subscription = undefined;
});

afterEach(() => {
  clearDemoNow();
  vi.useRealTimers();
});

describe("useLiveScores", () => {
  it("does not subscribe when no Game is live or about to start", () => {
    renderLiveScores(createTestQueryClient(), [
      game(1, 5 * HOUR),
      game(2, -3 * HOUR, { complete: 100, winnerTeamId: 20 }),
    ]);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("subscribes when a Game is under way", () => {
    renderLiveScores(createTestQueryClient(), [game(1, -HOUR, { complete: 40 })]);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("subscribes once a Game is 30 minutes from starting, without a re-render", () => {
    renderLiveScores(createTestQueryClient(), [game(1, 40 * MINUTE)]);
    expect(subscribe).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(10 * MINUTE + MINUTE);
    });
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("runs no clock when no Game starts within a day", () => {
    renderLiveScores(createTestQueryClient(), [game(1, 3 * 24 * HOUR)]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("writes updates into the cached Games", () => {
    const queryClient = createTestQueryClient();
    renderLiveScores(queryClient, [game(1, -HOUR, { complete: 40 }), game(2, 2 * HOUR)]);

    act(() => {
      capture.subscription!.onUpdate({
        gameId: 1,
        homeScore: 50,
        awayScore: 30,
        timeStr: "Q3  2:00",
        complete: 60,
      });
    });

    const cached = queryClient.getQueryData<AflGame[]>(aflQueries.allGamesKey())!;
    expect(cached[0]).toMatchObject({ homeScore: 50, awayScore: 30, timeStr: "Q3  2:00" });
  });

  it("refetches every list of Games after a resync", () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    renderLiveScores(queryClient, [game(1, -HOUR, { complete: 40 })]);

    act(() => capture.subscription!.onResync());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["afl", "games"] });
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderLiveScores(createTestQueryClient(), [
      game(1, -HOUR, { complete: 40 }),
    ]);
    expect(unsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes when the last Game completes", async () => {
    renderLiveScores(createTestQueryClient(), [game(1, -HOUR, { complete: 90 })]);

    act(() => {
      capture.subscription!.onUpdate({ gameId: 1, homeScore: 90, awayScore: 70, complete: 100 });
    });
    // React Query tells observers on a timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("stays subscribed while another Game is still live", async () => {
    renderLiveScores(createTestQueryClient(), [
      game(1, -HOUR, { complete: 90 }),
      game(2, -HOUR, { complete: 50 }),
    ]);

    act(() => {
      capture.subscription!.onUpdate({ gameId: 1, homeScore: 90, awayScore: 70, complete: 100 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it("reads the site clock, so the Demo clock decides what is live", () => {
    setDemoNow(T0 + 10 * HOUR);
    renderLiveScores(createTestQueryClient(), [game(1, 10 * HOUR + 5 * MINUTE)]);
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
