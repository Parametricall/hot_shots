import { describe, it, expect, vi, afterEach } from "vite-plus/test";
import { renderHook } from "@testing-library/react";
import { DEMO_VISITOR } from "./demo-visitor";

vi.mock("@clerk/tanstack-react-start", () => ({
  useUser: () => ({ user: { id: "clerk-user", fullName: "Clerk User", hasImage: false } }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("useCurrentUser", () => {
  it("is the Demo visitor, with the same id and name the Demo services use, in the Demo", async () => {
    vi.stubEnv("VITE_DEMO", "true");
    vi.resetModules();
    const { useCurrentUser } = await import("~/features/auth/use-current-user");

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toEqual({
      id: DEMO_VISITOR.userId,
      displayName: DEMO_VISITOR.displayName,
      imageUrl: DEMO_VISITOR.avatarUrl,
    });
  });

  it("is the Clerk user outside the Demo", async () => {
    vi.stubEnv("VITE_DEMO", "");
    vi.resetModules();
    const { useCurrentUser } = await import("~/features/auth/use-current-user");

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current).toEqual({ id: "clerk-user", displayName: "Clerk User", imageUrl: null });
  });
});
