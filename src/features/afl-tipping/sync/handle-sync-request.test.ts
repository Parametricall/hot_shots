import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("~/features/afl-tipping/sync/run-squiggle-sync", () => ({ runSquiggleSync: vi.fn() }));
vi.mock("~/features/afl-tipping/sync/live-ingest", () => ({ runLiveIngest: vi.fn() }));

import { runLiveIngest } from "~/features/afl-tipping/sync/live-ingest";
import { runSquiggleSync } from "~/features/afl-tipping/sync/run-squiggle-sync";
import {
  handleSyncRequest,
  liveIngestJob,
  squiggleSyncJob,
} from "~/features/afl-tipping/sync/handle-sync-request";

const SECRET = "test-secret";

function post(authorization?: string, method = "POST") {
  return new Request("https://example.test/api/sync/squiggle", {
    method,
    headers: authorization === undefined ? {} : { authorization },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runSquiggleSync).mockReset();
  vi.mocked(runLiveIngest).mockReset();
});

describe("handleSyncRequest", () => {
  it("answers 202 at once and runs the job inside waitUntil", async () => {
    let finish!: () => void;
    const job = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const waitUntil = vi.fn();

    const response = handleSyncRequest(post(`Bearer ${SECRET}`), {
      secret: SECRET,
      waitUntil,
      job,
    });

    expect(response.status).toBe(202);
    expect(job).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    finish();
    await waitUntil.mock.calls[0]![0];
  });

  it("does not start the job without a valid secret", () => {
    const job = vi.fn(async () => {});
    const waitUntil = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(handleSyncRequest(post(), { secret: SECRET, waitUntil, job }).status).toBe(401);
    expect(handleSyncRequest(post("Bearer nope"), { secret: SECRET, waitUntil, job }).status).toBe(
      401,
    );
    expect(
      handleSyncRequest(post(`Bearer ${SECRET}`), { secret: undefined, waitUntil, job }).status,
    ).toBe(503);
    expect(job).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("answers 405 to other methods, even with the right secret", () => {
    const job = vi.fn(async () => {});
    const waitUntil = vi.fn();

    const response = handleSyncRequest(post(`Bearer ${SECRET}`, "GET"), {
      secret: SECRET,
      waitUntil,
      job,
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(job).not.toHaveBeenCalled();
  });

  it("logs a job that throws instead of rejecting waitUntil", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const waitUntil = vi.fn();

    handleSyncRequest(post(`Bearer ${SECRET}`), {
      secret: SECRET,
      waitUntil,
      job: async () => {
        throw new Error("boom");
      },
    });

    await expect(waitUntil.mock.calls[0]![0]).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("[sync] job threw", "boom");
  });
});

describe("squiggleSyncJob", () => {
  const supabase = async () => ({}) as SupabaseClient;

  it("runs the sync with the client and the time, and logs a one-line summary", async () => {
    vi.mocked(runSquiggleSync).mockResolvedValue({
      ok: true,
      requests: 3,
      jobs: [
        { job: "fixture", ok: true, requests: 2 },
        { job: "ladder", ok: false, requests: 1, reason: "http-500", detail: "upstream" },
      ],
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await squiggleSyncJob({ supabase, now: () => 1234 })();

    expect(runSquiggleSync).toHaveBeenCalledWith({ supabase: {}, now: 1234 });
    expect(log).toHaveBeenCalledWith(
      "[squiggle-sync] ok: 3 request(s); fixture=ok(2) ladder=failed:http-500(1)",
    );
  });

  it("logs why a run did not start", async () => {
    vi.mocked(runSquiggleSync).mockResolvedValue({ ok: false, reason: "no-contact-email" });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await squiggleSyncJob({ supabase, now: () => 0 })();

    expect(error).toHaveBeenCalledWith("[squiggle-sync] did not run: no-contact-email");
  });
});

describe("liveIngestJob", () => {
  const supabase = async () => ({}) as SupabaseClient;

  it("stops a margin before the platform's deadline", async () => {
    vi.mocked(runLiveIngest).mockResolvedValue({ ok: true, connections: 1, stopped: "deadline" });
    vi.spyOn(console, "log").mockImplementation(() => {});

    await liveIngestJob({ supabase, now: () => 0, platformDeadline: () => 300_000 })();

    expect(runLiveIngest).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      deadline: 290_000,
      supabase: {},
    });
  });

  it("falls back to maxDuration from now when the platform gives no deadline", async () => {
    vi.mocked(runLiveIngest).mockResolvedValue({ ok: false, reason: "no-contact-email" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await liveIngestJob({ supabase, now: () => 1_000, platformDeadline: () => undefined })();

    expect(runLiveIngest).toHaveBeenCalledWith(
      expect.objectContaining({ deadline: 1_000 + 300_000 - 10_000 }),
    );
  });
});
