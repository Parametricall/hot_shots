import { describe, expect, it, vi } from "vite-plus/test";

const getClaims = vi.fn();
vi.mock("~/lib/supabase", () => ({
  getSupabaseAuthClient: () => ({ auth: { getClaims } }),
  getSupabaseServerClient: vi.fn(),
}));

import { getSessionUserId, safeRedirectPath } from "./session";

describe("safeRedirectPath", () => {
  it("keeps a path on this site", () => {
    expect(safeRedirectPath("/afl-tipping")).toBe("/afl-tipping");
    expect(safeRedirectPath("/afl-tipping/tips?round=3")).toBe("/afl-tipping/tips?round=3");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", undefined, 42, null])(
    "refuses %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/afl-tipping/tips");
    },
  );
});

describe("getSessionUserId", () => {
  it("is null with no session", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getSessionUserId()).toBeNull();
  });

  it("is null when the token is invalid", async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error("bad jwt") });
    expect(await getSessionUserId()).toBeNull();
  });

  it("is the Profile id from the verified claims", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "abc" } }, error: null });
    expect(await getSessionUserId()).toBe("abc");
  });
});
