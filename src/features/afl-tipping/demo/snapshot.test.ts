import { describe, it, expect } from "vite-plus/test";
import { buildLeaderboard } from "~/features/afl-tipping/api/competition";
import rawSnapshot from "./season-2026.json";
import { loadSnapshot, parseSnapshot } from "./snapshot";

describe("parseSnapshot", () => {
  it("parses the committed 2026 snapshot into domain types", () => {
    const result = parseSnapshot(rawSnapshot);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { snapshot } = result;
    expect(snapshot.season).toBe(2026);
    expect(snapshot.games.length).toBeGreaterThan(200);
    expect(snapshot.games[0]!.date).toBeInstanceOf(Date);
    expect(snapshot.teams).toHaveLength(18);
    expect(snapshot.standingsAfterRound.size).toBeGreaterThan(25);
    expect(snapshot.tipsters.length).toBeGreaterThanOrEqual(8);
  });

  it("rejects a corrupted snapshot instead of throwing", () => {
    const corrupted = { ...rawSnapshot, tips: "not an array" };
    expect(parseSnapshot(corrupted)).toMatchObject({ ok: false, reason: "parse-failed" });
  });

  it("rejects a Squiggle section that no longer matches the schemas", () => {
    const corrupted = {
      ...rawSnapshot,
      squiggle: { ...rawSnapshot.squiggle, games: { games: [{ id: "x" }] } },
    };
    expect(parseSnapshot(corrupted).ok).toBe(false);
  });

  it("rejects something that is not an object", () => {
    expect(parseSnapshot(null).ok).toBe(false);
  });
});

describe("loadSnapshot", () => {
  it("loads and parses the snapshot, once", async () => {
    const first = await loadSnapshot();
    expect(first.ok).toBe(true);
    expect(await loadSnapshot()).toBe(first);
  });
});

describe("the made-up Tipsters over the whole Season", () => {
  it("end with a spread of Scores and no two identical", async () => {
    const result = await loadSnapshot();
    if (!result.ok) throw new Error(result.detail);
    const { games, tips, tipsters } = result.snapshot;
    const board = buildLeaderboard({
      tips,
      games,
      tipsters: new Map(
        tipsters.map((t) => [
          t.userId,
          { displayName: t.displayName, avatarUrl: null, joinedAt: t.joinedAt },
        ]),
      ),
      now: Math.max(...games.map((g) => g.unixTime)) + 1,
    });
    const scores = board.map((e) => e.score);
    expect(new Set(scores).size).toBe(scores.length);
    expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(20);
  });
});
