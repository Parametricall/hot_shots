import { describe, it, expect } from "vite-plus/test";
import { GameRules } from "~/features/afl-tipping/api/game-rules";
import { createAflGame } from "~/features/afl-tipping/mocks/factories";
import type { AflGame, AflModelTip } from "~/features/afl-tipping/types";
import * as AflGameUtils from "~/features/afl-tipping/utils/afl-game";
import { PERSONAS, mulberry32, seedTips } from "./seed-tips";

const T0 = new Date("2026-03-12T09:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;
const ROUNDS = 24;
const GAMES_PER_ROUND = 9;
const FINALS_ROUND = ROUNDS + 1;

/** A synthetic Season: 24 Rounds of 9 Games and a Finals Round, winners from a fixed PRNG. */
function makeSeason() {
  const rng = mulberry32(42);
  const games: AflGame[] = [];
  const modelTips: AflModelTip[] = [];
  let id = 1;
  for (let round = 1; round <= FINALS_ROUND; round++) {
    for (let k = 0; k < GAMES_PER_ROUND; k++) {
      const homeTeamId = 100 + k * 2;
      const awayTeamId = 101 + k * 2;
      const unixTime = T0 + (round * 7 * 24 + k * 3) * HOUR;
      const homeWins = rng() < 0.55;
      const game = createAflGame({
        id,
        round,
        unixTime,
        date: new Date(unixTime),
        homeTeamId,
        awayTeamId,
        complete: 100,
        homeScore: homeWins ? 100 : 80,
        awayScore: homeWins ? 80 : 100,
        winnerTeamId: homeWins ? homeTeamId : awayTeamId,
        isFinals: round === FINALS_ROUND,
      });
      games.push(game);
      // The Model picks the winner 68% of the time.
      const modelRight = rng() < 0.68;
      const winner = game.winnerTeamId!;
      const loser = winner === homeTeamId ? awayTeamId : homeTeamId;
      modelTips.push({
        gameId: id,
        round,
        homeTeamId,
        awayTeamId,
        confidence: 60,
        homeConfidence: 60,
        awayConfidence: 40,
        tipTeamId: modelRight ? winner : loser,
      });
      id += 1;
    }
  }
  return { games, modelTips };
}

const { games, modelTips } = makeSeason();
const rows = seedTips({ personas: PERSONAS, games, modelTips });
const gameById = new Map(games.map((g) => [g.id, g]));

describe("seedTips", () => {
  it("gives the same output for the same input", () => {
    expect(seedTips({ personas: PERSONAS, games, modelTips })).toEqual(rows);
  });

  it("tips no Game twice", () => {
    const keys = rows.map((r) => `${r.user_id}:${r.game_id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("leaves skipped Games untipped, so they become Auto-tips", () => {
    const dani = PERSONAS.find((p) => p.displayName === "Dani Dropped")!;
    const tipped = rows.filter((r) => r.user_id === dani.userId).length;
    expect(tipped).toBeLessThan(games.length);
    expect(tipped / games.length).toBeGreaterThan(1 - dani.skipRate - 0.08);
  });

  it("sets a Margin only on each Round's Margin game", () => {
    const marginGameIds = new Set(
      Object.values(AflGameUtils.groupByRound(games)).map(
        (roundGames) => AflGameUtils.getFirstGameOfRound(roundGames)!.id,
      ),
    );
    for (const row of rows) {
      if (marginGameIds.has(row.game_id)) {
        expect(row.margin).toBeGreaterThanOrEqual(1);
        expect(row.margin).toBeLessThanOrEqual(60);
      } else {
        expect(row.margin).toBeNull();
      }
    }
  });

  it("marks a Tip against the Model tip as an Underdog tip", () => {
    const modelPick = new Map(modelTips.map((m) => [m.gameId, m.tipTeamId]));
    for (const row of rows) {
      expect(row.is_underdog).toBe(row.tip !== modelPick.get(row.game_id));
    }
  });

  it("leaves is_underdog null for a Game without a Model tip", () => {
    const withoutModel = seedTips({
      personas: PERSONAS.slice(0, 1),
      games,
      modelTips: modelTips.filter((m) => m.gameId !== 1),
    });
    expect(withoutModel.find((r) => r.game_id === 1)?.is_underdog).toBeNull();
  });

  it("tips 1 to 72 hours before the Game", () => {
    for (const row of rows) {
      const before = gameById.get(row.game_id)!.unixTime - new Date(row.created_at).getTime();
      expect(before).toBeGreaterThanOrEqual(HOUR);
      expect(before).toBeLessThanOrEqual(72 * HOUR);
    }
  });

  it("has a Tipster who usually misses the Underdog quota", () => {
    const kev = PERSONAS.find((p) => p.displayName === "Kev Kickin")!;
    const short = Array.from({ length: ROUNDS }, (_, i) => i + 1).filter((round) => {
      const underdogs = rows.filter(
        (r) =>
          r.user_id === kev.userId &&
          gameById.get(r.game_id)!.round === round &&
          r.is_underdog === true,
      ).length;
      return underdogs < GameRules.MINIMUM_UNDERDOGS_PER_ROUND;
    });
    expect(short.length).toBeGreaterThanOrEqual(1);
  });

  it("has a Perfect round", () => {
    const pat = PERSONAS.find((p) => p.perfectRounds?.length)!;
    const round = pat.perfectRounds![0]!;
    const patRows = rows.filter(
      (r) => r.user_id === pat.userId && gameById.get(r.game_id)!.round === round,
    );
    expect(patRows).toHaveLength(GAMES_PER_ROUND);
    expect(patRows.every((r) => r.tip === gameById.get(r.game_id)!.winnerTeamId)).toBe(true);
  });

  it("keeps each persona's accuracy within 10 points of its target", () => {
    for (const persona of PERSONAS) {
      const mine = rows.filter((r) => r.user_id === persona.userId);
      const correct = mine.filter((r) => r.tip === gameById.get(r.game_id)!.winnerTeamId).length;
      const accuracy = correct / mine.length;
      expect(Math.abs(accuracy - persona.accuracy)).toBeLessThanOrEqual(0.1);
    }
  });

  it("makes the late-surge persona better in the second half", () => {
    const sam = PERSONAS.find((p) => p.lateSurge)!;
    const accuracyIn = (from: number, to: number) => {
      const mine = rows.filter((r) => {
        const round = gameById.get(r.game_id)!.round;
        return r.user_id === sam.userId && round >= from && round <= to;
      });
      return (
        mine.filter((r) => r.tip === gameById.get(r.game_id)!.winnerTeamId).length / mine.length
      );
    };
    expect(accuracyIn(13, FINALS_ROUND)).toBeGreaterThan(accuracyIn(1, 12));
  });
});
