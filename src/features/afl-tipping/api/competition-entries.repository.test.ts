import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const eqSeason = vi.fn();
const maybeSingle = vi.fn();
const upsert = vi.fn();
const upsertSingle = vi.fn();
const select = vi.fn();

vi.mock("~/lib/supabase", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({
      select: (columns: string) => {
        select(columns);
        const chain = {
          eq: (column: string, value: unknown) => {
            if (column === "season") return eqSeason(value);
            return chain;
          },
        };
        return chain;
      },
      upsert: (row: unknown, options: unknown) => {
        upsert(row, options);
        return { select: () => ({ single: upsertSingle }) };
      },
    }),
  }),
}));

import { competitionEntriesRepository } from "./competition-entries.repository";

beforeEach(() => {
  eqSeason.mockReset();
  maybeSingle.mockReset();
  upsert.mockReset();
  upsertSingle.mockReset();
  select.mockReset();
});

describe("getEntrants", () => {
  it("maps rows to Tipsters, with joinedAt as the entry time in milliseconds", async () => {
    eqSeason.mockResolvedValue({
      data: [
        {
          profile_id: "p1",
          entered_at: "2027-03-01T00:00:00.000Z",
          afl_tipsters: { profiles: { display_name: "Ada", avatar_url: null } },
        },
      ],
      error: null,
    });

    const result = await competitionEntriesRepository.getEntrants(2027);

    expect(eqSeason).toHaveBeenCalledWith(2027);
    expect(result).toEqual({
      ok: true,
      tipsters: new Map([
        ["p1", { displayName: "Ada", avatarUrl: null, joinedAt: Date.UTC(2027, 2, 1) }],
      ]),
    });
  });

  it("is not ok on a Supabase error", async () => {
    eqSeason.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await competitionEntriesRepository.getEntrants(2027)).toEqual({
      ok: false,
      reason: "supabase-error",
      detail: "boom",
    });
  });

  it("is not ok on a malformed row", async () => {
    eqSeason.mockResolvedValue({ data: [{ profile_id: "p1" }], error: null });
    expect((await competitionEntriesRepository.getEntrants(2027)).ok).toBe(false);
  });
});

describe("enter", () => {
  it("sends only the keys, so an existing entry keeps its entered_at", async () => {
    upsertSingle.mockResolvedValue({
      data: { entered_at: "2027-03-01T00:00:00.000Z" },
      error: null,
    });
    expect(await competitionEntriesRepository.enter("p1", 2027)).toEqual({
      ok: true,
      enteredAt: Date.UTC(2027, 2, 1),
    });
    expect(upsert).toHaveBeenCalledWith(
      { profile_id: "p1", season: 2027 },
      { onConflict: "profile_id,season" },
    );
  });

  it("is not ok on a Supabase error", async () => {
    upsertSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await competitionEntriesRepository.enter("p1", 2027)).toMatchObject({ ok: false });
  });
});

describe("getEntry", () => {
  it("is the entry time in milliseconds", async () => {
    eqSeason.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({
      data: { entered_at: "2027-03-01T00:00:00.000Z" },
      error: null,
    });
    expect(await competitionEntriesRepository.getEntry("p1", 2027)).toEqual({
      ok: true,
      enteredAt: Date.UTC(2027, 2, 1),
    });
  });

  it("is null when the Tipster hasn't entered the Season", async () => {
    eqSeason.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await competitionEntriesRepository.getEntry("p1", 2027)).toEqual({
      ok: true,
      enteredAt: null,
    });
  });

  it("is not ok on a Supabase error", async () => {
    eqSeason.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await competitionEntriesRepository.getEntry("p1", 2027)).toMatchObject({ ok: false });
  });
});
