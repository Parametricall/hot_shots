import { GameRules } from "~/features/afl-tipping/api/game-rules";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import type { AflModelTip } from "~/features/afl-tipping/types";
import * as AflGame from "~/features/afl-tipping/utils/afl-game";

/**
 * The made-up Tipsters of the Demo (docs/adr/0004) and the Tips they make over a
 * whole Season. Only `scripts/snapshot-demo-season.ts` calls `seedTips`: it runs
 * once and commits the result into the snapshot, so the app only ever reads
 * the output. The output is deterministic, so regenerating it for the same
 * Season changes nothing.
 */

export type Persona = {
  userId: string; // "demo-tipster-1": made-up, clearly fictional
  displayName: string;
  accuracy: number; // chance of tipping the winner, averaged over the Season
  underdogTipsPerRound: number; // aimed for, outside Finals
  skipRate: number; // share of Games left untipped (they become Auto-tips)
  modelBias?: number; // chance of simply tipping the Model tip
  lateSurge?: number; // accuracy is this much lower in the first half and higher in the second
  perfectRounds?: number[]; // Rounds in which every Tip is a Correct tip
};

export const PERSONAS: Persona[] = [
  {
    userId: "demo-tipster-1",
    displayName: "Pat Premiership",
    accuracy: 0.74,
    underdogTipsPerRound: 2,
    skipRate: 0.01,
    perfectRounds: [9],
  },
  {
    userId: "demo-tipster-2",
    displayName: "Mia Mark",
    accuracy: 0.66,
    underdogTipsPerRound: 2,
    skipRate: 0.03,
  },
  {
    userId: "demo-tipster-3",
    displayName: "Sam Sidestep",
    accuracy: 0.62,
    underdogTipsPerRound: 3,
    skipRate: 0.02,
    lateSurge: 0.12,
  },
  {
    // Follows the Model, so usually falls short of the Underdog quota.
    userId: "demo-tipster-4",
    displayName: "Kev Kickin",
    accuracy: 0.66,
    underdogTipsPerRound: 0,
    skipRate: 0.02,
    modelBias: 0.9,
  },
  {
    // Forgets to tip, so Auto-tips land on a lot of Games.
    userId: "demo-tipster-5",
    displayName: "Dani Dropped",
    accuracy: 0.64,
    underdogTipsPerRound: 2,
    skipRate: 0.18,
  },
  {
    userId: "demo-tipster-6",
    displayName: "Ravi Ruck",
    accuracy: 0.6,
    underdogTipsPerRound: 2,
    skipRate: 0.05,
  },
  {
    userId: "demo-tipster-7",
    displayName: "Bec Behind",
    accuracy: 0.56,
    underdogTipsPerRound: 3,
    skipRate: 0.04,
  },
  {
    userId: "demo-tipster-8",
    displayName: "Tom Tackle",
    accuracy: 0.52,
    underdogTipsPerRound: 2,
    skipRate: 0.08,
  },
];

const HOUR_MS = 60 * 60 * 1000;
const MAX_MARGIN = 60;

/** Small, fast, seedable PRNG: the same seed gives the same sequence. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, to turn a user id into a PRNG seed. */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

type PlannedTip = {
  game: AflGame.Type;
  tip: number;
  modelPick: number | null;
  forcedCorrect: boolean;
};

function accuracyFor(persona: Persona, round: number, lastRound: number): number {
  if (!persona.lateSurge) return persona.accuracy;
  return round <= lastRound / 2
    ? persona.accuracy - persona.lateSurge
    : persona.accuracy + persona.lateSurge;
}

function planRound(args: {
  persona: Persona;
  rng: () => number;
  round: number;
  lastRound: number;
  roundGames: AflGame.Type[];
  modelPickByGame: Map<number, number>;
}): PlannedTip[] {
  const { persona, rng, round, lastRound, roundGames, modelPickByGame } = args;
  const perfect = persona.perfectRounds?.includes(round) ?? false;
  const accuracy = accuracyFor(persona, round, lastRound);
  const planned: PlannedTip[] = [];

  for (const game of roundGames) {
    // Four draws per Game, always, so one choice never shifts the next.
    const skipRoll = rng();
    const biasRoll = rng();
    const accuracyRoll = rng();
    const drawRoll = rng();
    if (game.homeTeamId == null || game.awayTeamId == null) continue;

    const modelPick = modelPickByGame.get(game.id) ?? null;
    const winner = game.winnerTeamId;
    const loser = winner === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    // In a Draw every Tip is wrong, so either team will do.
    const either = drawRoll < 0.5 ? game.homeTeamId : game.awayTeamId;

    if (perfect) {
      planned.push({
        game,
        tip: winner ?? game.homeTeamId,
        modelPick,
        forcedCorrect: true,
      });
      continue;
    }
    if (skipRoll < persona.skipRate) continue;

    let tip: number;
    if (modelPick != null && biasRoll < (persona.modelBias ?? 0)) {
      tip = modelPick;
    } else if (winner == null) {
      tip = either;
    } else {
      tip = accuracyRoll < accuracy ? winner : loser;
    }
    planned.push({ game, tip, modelPick, forcedCorrect: false });
  }
  return planned;
}

/** Flip Model-aligned Tips until the Round has `quota` Underdog tips, where possible. */
function meetUnderdogQuota(planned: PlannedTip[], quota: number, rng: () => number): void {
  const isUnderdog = (p: PlannedTip) => p.modelPick != null && p.tip !== p.modelPick;
  let missing = quota - planned.filter(isUnderdog).length;
  if (missing <= 0) return;

  const candidates = planned.filter(
    (p) => !p.forcedCorrect && !p.game.isFinals && p.modelPick != null && p.tip === p.modelPick,
  );
  // Fisher-Yates with the seeded PRNG.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  for (const candidate of candidates) {
    if (missing <= 0) break;
    const { game } = candidate;
    candidate.tip = candidate.tip === game.homeTeamId ? game.awayTeamId! : game.homeTeamId!;
    missing -= 1;
  }
}

/**
 * Every persona's Tips for every Game of the Season.
 *
 * - Each Game is skipped with `skipRate`; otherwise the persona tips the winner
 *   with its accuracy (the Model tip with `modelBias`), else the loser.
 * - Model-aligned Tips are then flipped until the Round has the persona's
 *   Underdog tips, outside Finals.
 * - Only each Round's Margin game carries a Margin (1-60).
 * - `is_underdog` is a Tip against the Model tip; `null` without a Model tip.
 * - `created_at` is 1-72 hours before the Game.
 */
export function seedTips(args: {
  personas: Persona[];
  games: AflGame.Type[];
  modelTips: AflModelTip[];
}): AllTipsRow[] {
  const { personas, games, modelTips } = args;
  const modelPickByGame = new Map<number, number>();
  for (const modelTip of modelTips) {
    if (modelTip.gameId != null && modelTip.tipTeamId != null) {
      modelPickByGame.set(modelTip.gameId, modelTip.tipTeamId);
    }
  }

  const gamesByRound = AflGame.groupByRound(games);
  const rounds = Object.keys(gamesByRound)
    .map(Number)
    .sort((a, b) => a - b);
  const lastRound = rounds[rounds.length - 1] ?? 0;
  const rows: AllTipsRow[] = [];

  for (const persona of personas) {
    const rng = mulberry32(hashString(persona.userId));
    for (const round of rounds) {
      const roundGames = AflGame.sortByDate(gamesByRound[round] ?? []);
      const marginGameId = AflGame.getFirstGameOfRound(roundGames)?.id;
      const planned = planRound({
        persona,
        rng,
        round,
        lastRound,
        roundGames,
        modelPickByGame,
      });
      meetUnderdogQuota(planned, persona.underdogTipsPerRound, rng);

      for (const { game, tip, modelPick } of planned) {
        const hoursBefore = 1 + rng() * 71;
        const margin = game.id === marginGameId ? 1 + Math.floor(rng() * MAX_MARGIN) : null;
        rows.push({
          game_id: game.id,
          user_id: persona.userId,
          tip,
          margin,
          is_underdog: modelPick == null ? null : tip !== modelPick,
          created_at: new Date(game.unixTime - hoursBefore * HOUR_MS).toISOString(),
        });
      }
    }
  }
  return rows;
}

/** Whether a Round's Tips reach the Underdog quota (used by the tests and the script's report). */
export function meetsUnderdogQuota(rows: AllTipsRow[]): boolean {
  return rows.filter((r) => r.is_underdog === true).length >= GameRules.MINIMUM_UNDERDOGS_PER_ROUND;
}
