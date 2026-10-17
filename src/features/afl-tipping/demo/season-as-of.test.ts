import { describe, it, expect } from "vite-plus/test";
import { createAflGame, createAflStanding } from "~/features/afl-tipping/mocks/factories";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import { gameAsOf, gamesAsOf, standingsAsOf, tipsAsOf } from "./season-as-of";

const T0 = new Date("2026-06-04T09:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

function finished(id: number, round: number, hoursFromT0: number) {
  const unixTime = T0 + hoursFromT0 * HOUR;
  return createAflGame({
    id,
    round,
    unixTime,
    date: new Date(unixTime),
    homeTeamId: 1,
    awayTeamId: 2,
    homeScore: 100,
    awayScore: 80,
    winnerTeamId: 1,
    complete: 100,
    timeStr: "Full Time",
  });
}

describe("gameAsOf", () => {
  const game = finished(1, 5, 10);

  it("leaves a started Game unchanged", () => {
    expect(gameAsOf(game, game.unixTime)).toBe(game);
    expect(gameAsOf(game, game.unixTime + HOUR)).toBe(game);
  });

  it("resets every result field of a later Game", () => {
    expect(gameAsOf(game, game.unixTime - 1)).toMatchObject({
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      complete: 0,
      timeStr: "Not Started",
      id: 1,
      round: 5,
    });
  });
});

describe("the active Round over a masked Season", () => {
  it("is the first Round that has a Game after the Demo clock", () => {
    const games = [finished(1, 1, 0), finished(2, 1, 5), finished(3, 2, 20), finished(4, 3, 40)];
    expect(AflGame.getActiveRound(gamesAsOf(games, T0 + 10 * HOUR))).toBe(2);
    expect(AflGame.getActiveRound(gamesAsOf(games, T0 + 21 * HOUR))).toBe(3);
    expect(AflGame.getActiveRound(gamesAsOf(games, T0 + 100 * HOUR))).toBe(0);
  });
});

describe("standingsAsOf", () => {
  const games = [finished(1, 1, 0), finished(2, 1, 5), finished(3, 2, 20)];
  const round1 = [createAflStanding({ id: 1, name: "Lions", played: 1, wins: 1 })];
  const round2 = [
    createAflStanding({ id: 1, name: "Lions", played: 2, wins: 2 }),
    createAflStanding({ id: 2, name: "Suns", played: 2, wins: 0 }),
  ];
  const snapshot = {
    standingsAfterRound: new Map([
      [1, round1],
      [2, round2],
    ]),
  };

  it("zeroes every record before the first Round is complete", () => {
    const ladder = standingsAsOf(snapshot, games, T0 + 2 * HOUR);
    expect(ladder.map((t) => t.name)).toEqual(["Lions", "Suns"]);
    expect(ladder.every((t) => t.played === 0 && t.wins === 0 && t.points === 0)).toBe(true);
    expect(ladder.map((t) => t.rank)).toEqual([1, 2]);
  });

  it("shows the latest Round whose every Game has started", () => {
    expect(standingsAsOf(snapshot, games, T0 + 5 * HOUR)).toBe(round1);
    expect(standingsAsOf(snapshot, games, T0 + 19 * HOUR)).toBe(round1);
    expect(standingsAsOf(snapshot, games, T0 + 20 * HOUR)).toBe(round2);
  });
});

describe("tipsAsOf", () => {
  const games = [finished(1, 1, 0), finished(2, 2, 20), finished(3, 3, 40)];
  const row = (gameId: number): AllTipsRow => ({
    game_id: gameId,
    user_id: "u",
    tip: 1,
    margin: null,
    is_underdog: false,
    created_at: "2026-06-01T00:00:00.000Z",
  });
  const tips = [row(1), row(2), row(3)];

  it("keeps Tips up to the current Round and drops later Rounds", () => {
    expect(tipsAsOf(tips, games, T0 - HOUR).map((t) => t.game_id)).toEqual([1]);
    expect(tipsAsOf(tips, games, T0 + 10 * HOUR).map((t) => t.game_id)).toEqual([1, 2]);
  });

  it("keeps everything once every Game has started", () => {
    expect(tipsAsOf(tips, games, T0 + 100 * HOUR)).toBe(tips);
  });
});
