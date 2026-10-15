import { describe, it, expect } from "vite-plus/test";
import { findAutoTips, toAutoTipRow } from "./auto-tips";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";

const T0 = new Date("2026-03-20T09:00:00Z").getTime();
const HOUR = 1000 * 60 * 60;

function game(id: number, overrides: Parameters<typeof createAflGame>[0] = {}) {
  return createAflGame({
    id,
    unixTime: T0 + id * HOUR,
    date: new Date(T0 + id * HOUR),
    homeTeamId: 10 + id,
    awayTeamId: 20 + id,
    ...overrides,
  });
}

const LONG_AGO = T0 - 1000 * HOUR;
const NOW = T0 + 100 * HOUR;

describe("findAutoTips", () => {
  it("gives the home team to a Tipster who missed a started Game", () => {
    const result = findAutoTips({
      games: [game(1)],
      tips: [],
      joinedAtByTipster: new Map([["u1", LONG_AGO]]),
      now: NOW,
    });
    expect(result).toEqual([{ gameId: 1, userId: "u1", tipTeamId: 11 }]);
  });

  it("gives nothing when the Tipster already tipped the Game", () => {
    const result = findAutoTips({
      games: [game(1)],
      tips: [{ game_id: 1, user_id: "u1" }],
      joinedAtByTipster: new Map([["u1", LONG_AGO]]),
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("gives nothing before the Game has started", () => {
    const g = game(1);
    const result = findAutoTips({
      games: [g],
      tips: [],
      joinedAtByTipster: new Map([["u1", LONG_AGO]]),
      now: g.unixTime - 1,
    });
    expect(result).toEqual([]);
  });

  it("gives nothing to a Tipster who joined at or after the Game started", () => {
    const g = game(1);
    const result = findAutoTips({
      games: [g],
      tips: [],
      joinedAtByTipster: new Map([
        ["at", g.unixTime],
        ["after", g.unixTime + 1],
      ]),
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("gives nothing when the Game has no home team", () => {
    const result = findAutoTips({
      games: [game(1, { homeTeamId: null })],
      tips: [],
      joinedAtByTipster: new Map([["u1", LONG_AGO]]),
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it("returns exactly the missing Tipster/Game pairs", () => {
    const result = findAutoTips({
      games: [game(1), game(2)],
      tips: [
        { game_id: 1, user_id: "u1" },
        { game_id: 2, user_id: "u2" },
      ],
      joinedAtByTipster: new Map([
        ["u1", LONG_AGO],
        ["u2", LONG_AGO],
      ]),
      now: NOW,
    });
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ gameId: 2, userId: "u1", tipTeamId: 12 });
    expect(result).toContainEqual({ gameId: 1, userId: "u2", tipTeamId: 11 });
  });
});

describe("toAutoTipRow", () => {
  it("has no margin or underdog status and is flagged as an Auto-tip", () => {
    const g = game(1);
    const row = toAutoTipRow({ gameId: 1, userId: "u1", tipTeamId: 11 }, g);
    expect(row).toMatchObject({
      game_id: 1,
      user_id: "u1",
      tip: 11,
      margin: null,
      is_underdog: null,
      is_auto_tip: true,
    });
  });
});
