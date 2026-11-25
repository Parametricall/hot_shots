import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getClaims = vi.fn();
const getSession = vi.fn();
vi.mock("~/lib/supabase", () => ({
  getSupabaseAuthClient: () => ({ auth: { getClaims, getSession } }),
  getSupabaseServerClient: vi.fn(),
}));

import { readRealtimeToken } from "./realtime-token";

beforeEach(() => {
  getClaims.mockReset();
  getSession.mockReset();
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

describe("readRealtimeToken", () => {
  it("is unauthenticated with no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await readRealtimeToken()).toEqual({ ok: false, reason: "unauthenticated" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("is unauthenticated when the token is invalid", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("bad jwt") });
    expect(await readRealtimeToken()).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("returns the access token and its expiry, never the refresh token", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "abc" } }, error: null });
    getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "jwt",
          refresh_token: "secret-refresh",
          expires_at: 1_800_000_000,
        },
      },
      error: null,
    });

    const result = await readRealtimeToken();

    expect(result).toEqual({
      ok: true,
      accessToken: "jwt",
      expiresAt: 1_800_000_000_000,
      publishableKey: "sb_publishable_test",
    });
    expect(JSON.stringify(result)).not.toContain("secret-refresh");
  });

  it("is unauthenticated when the claims verify but no session is left", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "abc" } }, error: null });
    getSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await readRealtimeToken()).toEqual({ ok: false, reason: "unauthenticated" });
  });
});
