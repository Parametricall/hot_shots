import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const select = vi.fn();
const upsertSingle = vi.fn();
vi.mock("~/lib/supabase", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({
      select,
      upsert: () => ({ select: () => ({ single: upsertSingle }) }),
    }),
  }),
}));

import { tipstersRepository } from "./tipsters.repository";

beforeEach(() => {
  select.mockReset();
  upsertSingle.mockReset();
});

describe("getTipsters", () => {
  it("maps rows to Tipsters, with joinedAt in milliseconds and a null avatar", async () => {
    select.mockResolvedValue({
      data: [
        {
          profile_id: "p1",
          joined_at: "2026-03-01T00:00:00.000Z",
          profiles: { display_name: "Ada Lovelace", avatar_url: null },
        },
        {
          profile_id: "p2",
          joined_at: "2026-04-01T00:00:00.000Z",
          profiles: { display_name: "Grace", avatar_url: "https://example.com/g.png" },
        },
      ],
      error: null,
    });

    const result = await tipstersRepository.getTipsters();

    expect(result).toEqual({
      ok: true,
      tipsters: new Map([
        ["p1", { displayName: "Ada Lovelace", avatarUrl: null, joinedAt: Date.UTC(2026, 2, 1) }],
        [
          "p2",
          {
            displayName: "Grace",
            avatarUrl: "https://example.com/g.png",
            joinedAt: Date.UTC(2026, 3, 1),
          },
        ],
      ]),
    });
  });

  it("is not ok on a Supabase error", async () => {
    select.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await tipstersRepository.getTipsters()).toEqual({
      ok: false,
      reason: "supabase-error",
      detail: "boom",
    });
  });

  it("is not ok on a malformed row", async () => {
    select.mockResolvedValue({ data: [{ profile_id: "p1" }], error: null });
    const result = await tipstersRepository.getTipsters();
    expect(result.ok).toBe(false);
  });
});

describe("joinAflTipping", () => {
  it("returns joined_at in milliseconds", async () => {
    upsertSingle.mockResolvedValue({
      data: { joined_at: "2026-03-01T00:00:00.000Z" },
      error: null,
    });
    expect(await tipstersRepository.joinAflTipping("p1")).toEqual({
      ok: true,
      joinedAt: Date.UTC(2026, 2, 1),
    });
  });

  it("is not ok on a Supabase error", async () => {
    upsertSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await tipstersRepository.joinAflTipping("p1")).toMatchObject({ ok: false });
  });
});
