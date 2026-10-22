import { describe, it, expect, afterEach, vi } from "vite-plus/test";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DEMO_VISITOR } from "./demo-visitor";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("useCurrentUser", () => {
  it("is the Demo visitor, with the same id and name the Demo services use, in the Demo", async () => {
    vi.stubEnv("VITE_DEMO", "true");
    vi.resetModules();
    const { useCurrentUser } = await import("~/features/auth/use-current-user");

    const { result } = renderHook(() => useCurrentUser(), { wrapper: wrapperWith(null) });
    expect(result.current).toEqual({
      id: DEMO_VISITOR.userId,
      displayName: DEMO_VISITOR.displayName,
      imageUrl: DEMO_VISITOR.avatarUrl,
    });
  });

  it("is the signed-in Profile outside the Demo", async () => {
    vi.stubEnv("VITE_DEMO", "");
    vi.resetModules();
    const { useCurrentUser } = await import("~/features/auth/use-current-user");
    const profile = { id: "profile-1", displayName: "Jane Doe", imageUrl: null };

    const { result } = renderHook(() => useCurrentUser(), { wrapper: wrapperWith(profile) });
    expect(result.current).toEqual(profile);
  });

  it("is undefined when signed out", async () => {
    vi.stubEnv("VITE_DEMO", "");
    vi.resetModules();
    const { useCurrentUser } = await import("~/features/auth/use-current-user");

    const { result } = renderHook(() => useCurrentUser(), { wrapper: wrapperWith(null) });
    expect(result.current).toBeUndefined();
  });
});

/** A QueryClient whose current-user query is already answered, so no server function runs. */
function wrapperWith(user: { id: string; displayName: string; imageUrl: string | null } | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  queryClient.setQueryData(["auth", "current-user"], user);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
