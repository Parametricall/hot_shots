import { describe, expect, it, vi } from "vite-plus/test";
import { authorizeSyncRequest } from "~/features/afl-tipping/sync/authorize-sync-request";

const SECRET = "correct-horse-battery-staple";

function requestWith(authorization?: string) {
  return new Request("https://example.test/api/sync/squiggle", {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });
}

describe("authorizeSyncRequest", () => {
  it("accepts the right bearer token", () => {
    expect(authorizeSyncRequest(requestWith(`Bearer ${SECRET}`), SECRET)).toEqual({ ok: true });
  });

  it("rejects a missing header with 401", () => {
    expect(authorizeSyncRequest(requestWith(), SECRET)).toEqual({
      ok: false,
      status: 401,
      reason: "unauthorized",
    });
  });

  it("rejects a wrong token of the same length with 401", () => {
    const wrong = "x".repeat(SECRET.length);
    expect(authorizeSyncRequest(requestWith(`Bearer ${wrong}`), SECRET)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("rejects tokens of another length without throwing", () => {
    expect(authorizeSyncRequest(requestWith("Bearer short"), SECRET)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(authorizeSyncRequest(requestWith(`Bearer ${SECRET}extra`), SECRET)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("rejects a header that is not a bearer token", () => {
    expect(authorizeSyncRequest(requestWith(SECRET), SECRET)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(authorizeSyncRequest(requestWith(`Basic ${SECRET}`), SECRET)).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("answers 503 and logs when the server has no secret, even for a matching empty token", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const secret of [undefined, ""]) {
      expect(authorizeSyncRequest(requestWith("Bearer "), secret)).toEqual({
        ok: false,
        status: 503,
        reason: "no-secret",
      });
    }
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
