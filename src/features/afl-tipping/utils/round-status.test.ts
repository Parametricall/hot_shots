import { describe, expect, it } from "vite-plus/test";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import {
  formatCountdown,
  formatLockout,
  roundDotStatus,
  roundStatus,
  roundStatusText,
} from "./round-status";

const NOW = Date.UTC(2026, 4, 20, 0, 0, 0); // Wed 20 May 2026, 10:00am in Melbourne
const HOUR = 60 * 60 * 1000;

const game = (id: number, startsInHours: number, overrides = {}) =>
  createAflGame({
    id,
    round: 3,
    homeTeamId: 1,
    awayTeamId: 2,
    unixTime: NOW + startsInHours * HOUR,
    date: new Date(NOW + startsInHours * HOUR),
    ...overrides,
  });

const tip = (gameId: number) => ({ gameId, tipTeamId: 1 });

describe("roundDotStatus", () => {
  it("is tipped when every open Game has a Tip", () => {
    expect(roundDotStatus([game(1, 5), game(2, 30)], [tip(1), tip(2)], NOW)).toBe("tipped");
  });

  it("is untipped when an open Game has none", () => {
    expect(roundDotStatus([game(1, 5), game(2, 30)], [tip(1)], NOW)).toBe("untipped");
  });

  it("ignores a started Game with no Tip", () => {
    expect(roundDotStatus([game(1, -5), game(2, 30)], [tip(2)], NOW)).toBe("tipped");
  });

  it("is closed once every Game has started", () => {
    expect(roundDotStatus([game(1, -5), game(2, -1)], [], NOW)).toBe("closed");
  });

  it("is undefined with no Games to tip", () => {
    expect(roundDotStatus([], [], NOW)).toBeUndefined();
    expect(roundDotStatus([game(1, 5, { homeTeamId: null })], [], NOW)).toBeUndefined();
  });
});

describe("roundStatus", () => {
  it("counts Tips and finds the next Lockout", () => {
    const status = roundStatus([game(1, 30), game(2, 5), game(3, -2)], [tip(1), tip(3)], NOW);
    expect(status).toEqual({ tipped: 2, total: 3, phase: "open", nextLockoutAt: NOW + 5 * HOUR });
  });

  it("is locked once every Game has started but one is unfinished", () => {
    const status = roundStatus([game(1, -5, { complete: 100 }), game(2, -1)], [], NOW);
    expect(status).toMatchObject({ phase: "locked", nextLockoutAt: null });
  });

  it("is complete once every Game is", () => {
    const status = roundStatus(
      [game(1, -5, { complete: 100 }), game(2, -1, { complete: 100 })],
      [],
      NOW,
    );
    expect(status?.phase).toBe("complete");
  });

  it("is null with no Games to tip", () => {
    expect(roundStatus([], [], NOW)).toBeNull();
  });
});

describe("formatCountdown", () => {
  it.each([
    [2 * 24 * HOUR + 3 * HOUR + 59 * 60_000, "2d 3h"],
    [3 * HOUR + 5 * 60_000, "3h 5m"],
    [12 * 60_000 + 30_000, "12m"],
    [30_000, "<1m"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe("formatLockout", () => {
  it("writes the day and time in Melbourne", () => {
    // 09:40 UTC on Thu 21 May 2026 is 7:40pm in Melbourne (UTC+10)
    expect(formatLockout(Date.UTC(2026, 4, 21, 9, 40))).toBe("Thu 7:40pm");
  });
});

describe("roundStatusText", () => {
  it("counts down to the next Lockout", () => {
    const status = roundStatus([game(1, 55), game(2, 80)], [tip(1)], NOW)!;
    expect(roundStatusText(status, NOW)).toBe("1/2 tipped · Locks Fri 5:00pm (2d 7h)");
  });

  it("says when the Round is locked or complete", () => {
    const locked = roundStatus([game(1, -2)], [tip(1)], NOW)!;
    expect(roundStatusText(locked, NOW)).toBe("1/1 tipped · Round locked");
    const complete = roundStatus([game(1, -2, { complete: 100 })], [tip(1)], NOW)!;
    expect(roundStatusText(complete, NOW)).toBe("1/1 tipped · Round complete");
  });
});
