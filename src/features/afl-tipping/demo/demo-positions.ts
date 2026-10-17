import type { AflGame } from "~/features/afl-tipping/types";

/**
 * Where the Time control can put the Demo clock (docs/adr/0004): just before
 * each Game starts, plus a last "Season over". Pure, so the moves are tested
 * without a browser.
 */

export const DEMO_START_ROUND = 12;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const SEASON_OVER_AFTER_LAST_GAME_MS = 6 * HOUR_MS;

export type DemoPosition =
  | {
      kind: "before-game";
      at: number; // the Demo clock, epoch ms: one minute before the Game starts
      round: number;
      roundName: string;
      gameNumber: number; // 1-based, among the Round's Games by start time
      roundGameCount: number;
    }
  | { kind: "season-over"; at: number };

/** One position per distinct Game start time, sorted, then "Season over". */
export function buildPositions(games: AflGame[]): DemoPosition[] {
  const byRound = new Map<number, AflGame[]>();
  for (const game of games) {
    byRound.set(game.round, [...(byRound.get(game.round) ?? []), game]);
  }

  const positions = new Map<number, DemoPosition>();
  for (const [round, roundGames] of byRound) {
    const sorted = roundGames.toSorted((a, b) => a.unixTime - b.unixTime);
    sorted.forEach((game, index) => {
      const at = game.unixTime - MINUTE_MS;
      if (positions.has(at)) return; // Games that start together share a position
      positions.set(at, {
        kind: "before-game",
        at,
        round,
        roundName: game.roundName,
        gameNumber: index + 1,
        roundGameCount: sorted.length,
      });
    });
  }

  const sorted = [...positions.values()].sort((a, b) => a.at - b.at);
  const lastGameAt = Math.max(...games.map((g) => g.unixTime));
  sorted.push({ kind: "season-over", at: lastGameAt + SEASON_OVER_AFTER_LAST_GAME_MS });
  return sorted;
}

/** Index of the latest position at or before `at`; 0 if `at` is before them all. */
export function positionIndexAt(positions: DemoPosition[], at: number): number {
  let index = 0;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i]!.at <= at) index = i;
  }
  return index;
}

const clamp = (positions: DemoPosition[], index: number) =>
  positions[Math.min(Math.max(index, 0), positions.length - 1)]!;

export function nextGame(positions: DemoPosition[], at: number): DemoPosition {
  return clamp(positions, positionIndexAt(positions, at) + 1);
}

export function previousGame(positions: DemoPosition[], at: number): DemoPosition {
  const index = positionIndexAt(positions, at);
  // Between positions (a restored clock mid-way): step back to the one we are past.
  return clamp(positions, positions[index]!.at < at ? index : index - 1);
}

/** The first position of `round`, or undefined if the Season has no such Round. */
export function roundStart(positions: DemoPosition[], round: number): DemoPosition | undefined {
  return positions.find((p) => p.kind === "before-game" && p.round === round);
}

export function roundsOf(positions: DemoPosition[]): { round: number; roundName: string }[] {
  const seen = new Map<number, string>();
  for (const p of positions) {
    if (p.kind === "before-game" && !seen.has(p.round)) seen.set(p.round, p.roundName);
  }
  return [...seen].map(([round, roundName]) => ({ round, roundName }));
}

/** The first position of the next Round, or "Season over" after the last Round. */
export function nextRound(positions: DemoPosition[], at: number): DemoPosition {
  const current = positions[positionIndexAt(positions, at)]!;
  if (current.kind === "season-over") return current;
  const next = positions.find((p) => p.kind === "before-game" && p.round > current.round);
  return next ?? positions[positions.length - 1]!;
}

/** The first position of this Round, or of the previous Round if already there. */
export function previousRound(positions: DemoPosition[], at: number): DemoPosition {
  const current = positions[positionIndexAt(positions, at)]!;
  const rounds = roundsOf(positions).map((r) => r.round);
  if (current.kind === "season-over") {
    return roundStart(positions, rounds[rounds.length - 1]!) ?? current;
  }
  const thisStart = roundStart(positions, current.round)!;
  if (at > thisStart.at) return thisStart;
  const earlier = rounds.filter((r) => r < current.round);
  const previous = earlier.length > 0 ? roundStart(positions, Math.max(...earlier)) : undefined;
  return previous ?? thisStart;
}

/** Where a first visit starts: just before the first Game of the start Round. */
export function startingPosition(positions: DemoPosition[]): DemoPosition {
  return roundStart(positions, DEMO_START_ROUND) ?? positions[0]!;
}

export function describePosition(position: DemoPosition): string {
  if (position.kind === "season-over") return "Season over";
  return `${position.roundName} · before Game ${position.gameNumber} of ${position.roundGameCount}`;
}
