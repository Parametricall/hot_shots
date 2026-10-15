import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTipMutation } from "./use-tip-mutation";
import { aflQueries } from "~/features/afl-tipping/api/queries";
import type { AflUserTip } from "~/features/afl-tipping/types";
import type { ReactNode } from "react";

const { mockSubmitTip } = vi.hoisted(() => ({
  mockSubmitTip: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("~/app/service-registry", () => ({
  default: {
    getService: vi.fn().mockReturnValue({
      getTips: vi.fn().mockResolvedValue([]),
      getGroupTips: vi.fn().mockResolvedValue([]),
      submitTip: mockSubmitTip,
    }),
  },
}));

const GAME_IDS = [100, 200];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useTipMutation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  it("optimistically updates the getTips cache with the new margin", async () => {
    const existingTips: AflUserTip[] = [{ gameId: 100, tipTeamId: 1 }];
    queryClient.setQueryData(aflQueries.getTips(GAME_IDS).queryKey, existingTips);

    const { result } = renderHook(() => useTipMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync({ data: { gameId: 100, teamId: 1, margin: 25 } }));

    const cached = queryClient.getQueryData<AflUserTip[]>(aflQueries.getTips(GAME_IDS).queryKey);
    expect(cached).toEqual([{ gameId: 100, tipTeamId: 1, margin: 25 }]);
  });

  it("drops the stale isUnderdog snapshot when the user switches teams", async () => {
    // The stored snapshot describes the previously tipped team's model status.
    // Consciously switching teams must not carry it over, otherwise
    // getTipSnapshotMismatch would show a false "no longer matches" notice.
    const existingTips: AflUserTip[] = [{ gameId: 100, tipTeamId: 1, isUnderdog: false }];
    queryClient.setQueryData(aflQueries.getTips(GAME_IDS).queryKey, existingTips);

    const { result } = renderHook(() => useTipMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync({ data: { gameId: 100, teamId: 2 } }));

    const cached = queryClient.getQueryData<AflUserTip[]>(aflQueries.getTips(GAME_IDS).queryKey);
    expect(cached).toEqual([
      { gameId: 100, tipTeamId: 2, margin: undefined, isUnderdog: undefined },
    ]);
  });

  it("preserves the isUnderdog snapshot when only the margin changes", async () => {
    const existingTips: AflUserTip[] = [{ gameId: 100, tipTeamId: 1, isUnderdog: true }];
    queryClient.setQueryData(aflQueries.getTips(GAME_IDS).queryKey, existingTips);

    const { result } = renderHook(() => useTipMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync({ data: { gameId: 100, teamId: 1, margin: 40 } }));

    const cached = queryClient.getQueryData<AflUserTip[]>(aflQueries.getTips(GAME_IDS).queryKey);
    expect(cached).toEqual([{ gameId: 100, tipTeamId: 1, margin: 40, isUnderdog: true }]);
  });

  it("adds a new tip when the game has no existing tip", async () => {
    queryClient.setQueryData(aflQueries.getTips(GAME_IDS).queryKey, []);

    const { result } = renderHook(() => useTipMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync({ data: { gameId: 200, teamId: 3, margin: 10 } }));

    const cached = queryClient.getQueryData<AflUserTip[]>(aflQueries.getTips(GAME_IDS).queryKey);
    expect(cached).toEqual([{ gameId: 200, tipTeamId: 3, margin: 10 }]);
  });

  it("invalidates groupTips cache after mutation settles", async () => {
    const tipsKey = aflQueries.getTips(GAME_IDS).queryKey;
    const groupTipsKey = aflQueries.groupTips(1).queryKey;

    queryClient.setQueryData(tipsKey, [{ gameId: 100, tipTeamId: 1 }]);
    queryClient.setQueryData(groupTipsKey, [
      {
        userId: "u1",
        displayName: "User 1",
        avatarUrl: null,
        gameId: 100,
        hasTipped: true,
        tipTeamId: null,
      },
    ]);

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTipMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(() => result.current.mutateAsync({ data: { gameId: 100, teamId: 1, margin: 30 } }));

    await waitFor(() => {
      const groupTipsInvalidation = invalidateSpy.mock.calls.find((call) => {
        const arg = call[0] as { queryKey?: readonly unknown[] };
        return (
          arg.queryKey &&
          JSON.stringify(arg.queryKey) === JSON.stringify(aflQueries.allGroupTipsKey())
        );
      });
      expect(groupTipsInvalidation).toBeDefined();
    });
  });

  it("rolls back getTips cache on error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSubmitTip.mockRejectedValueOnce(new Error("Server error"));

    const originalTips: AflUserTip[] = [{ gameId: 100, tipTeamId: 1 }];
    queryClient.setQueryData(aflQueries.getTips(GAME_IDS).queryKey, originalTips);

    const { result } = renderHook(() => useTipMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ data: { gameId: 100, teamId: 2, margin: 15 } });
      } catch {
        // expected
      }
    });

    const cached = queryClient.getQueryData<AflUserTip[]>(aflQueries.getTips(GAME_IDS).queryKey);
    expect(cached).toEqual(originalTips);
    consoleErrorSpy.mockRestore();
  });
});
