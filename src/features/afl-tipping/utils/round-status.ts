import * as AflGame from "~/features/afl-tipping/utils/afl-game";
import type { AflGame as Game, AflUserTip } from "~/features/afl-tipping/types";

/**
 * What a Round looks like to the Tipster, from its Games and their Tips. Pure, so the Demo runs the
 * same code as production (docs/adr/0004).
 */

/**
 * `tipped`: every Game still open for Tips has one. `untipped`: an open Game has none. `closed`:
 * no Game is open any more, so the Round is locked or complete. Undefined for a Round with no
 * Games to tip.
 */
export type RoundDotStatus = "tipped" | "untipped" | "closed";

/** A Game with both teams known: the only kind that can be tipped. */
const isTippable = (game: Game) => game.homeTeamId != null && game.awayTeamId != null;

export function roundDotStatus(
  games: Game[],
  tips: AflUserTip[],
  at: number,
): RoundDotStatus | undefined {
  const tippable = games.filter(isTippable);
  if (tippable.length === 0) return undefined;
  const open = tippable.filter((game) => !AflGame.hasStarted(game, at));
  if (open.length === 0) return "closed";
  const tippedIds = new Set(tips.map((tip) => tip.gameId));
  return open.every((game) => tippedIds.has(game.id)) ? "tipped" : "untipped";
}

export type RoundStatus = {
  tipped: number;
  total: number;
  /** `open` while a Game is yet to start, `locked` once all have, `complete` once all are done. */
  phase: "open" | "locked" | "complete";
  /** The start of the next Game to start (the next Lockout), epoch ms; null unless `open`. */
  nextLockoutAt: number | null;
};

/** The Round's progress and phase. Null for a Round with no Games to tip. */
export function roundStatus(games: Game[], tips: AflUserTip[], at: number): RoundStatus | null {
  const tippable = games.filter(isTippable);
  if (tippable.length === 0) return null;
  const tippedIds = new Set(tips.map((tip) => tip.gameId));
  const upcoming = tippable.filter((game) => !AflGame.hasStarted(game, at));
  const phase =
    upcoming.length > 0 ? "open" : tippable.every(AflGame.isComplete) ? "complete" : "locked";
  return {
    tipped: tippable.filter((game) => tippedIds.has(game.id)).length,
    total: tippable.length,
    phase,
    nextLockoutAt: upcoming.length > 0 ? Math.min(...upcoming.map((game) => game.unixTime)) : null,
  };
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "2d 3h", "3h 5m", "12m" or "<1m": the two biggest units of a wait. */
export function formatCountdown(ms: number): string {
  if (ms >= DAY_MS) {
    return `${Math.floor(ms / DAY_MS)}d ${Math.floor((ms % DAY_MS) / HOUR_MS)}h`;
  }
  if (ms >= HOUR_MS) {
    return `${Math.floor(ms / HOUR_MS)}h ${Math.floor((ms % HOUR_MS) / MINUTE_MS)}m`;
  }
  if (ms >= MINUTE_MS) return `${Math.floor(ms / MINUTE_MS)}m`;
  return "<1m";
}

/** A Game's start as day and time in `timeZone`: "Thu 7:40pm". */
export function formatGameStart(at: number, timeZone: string): string {
  const format = new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  });
  const parts = Object.fromEntries(format.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.hour}:${parts.minute}${String(parts.dayPeriod).toLowerCase()}`;
}

/**
 * The status line's words: "6/9 tipped · Next game Thu 7:40pm (2d 3h)". It doesn't mention
 * Lockout: each Game locks as it starts, and "Locks …" read as if the whole Round did.
 */
export function roundStatusText(status: RoundStatus, at: number, timeZone: string): string {
  const progress = `${status.tipped}/${status.total} tipped`;
  if (status.phase === "complete") return `${progress} · Round complete`;
  if (status.phase === "locked" || status.nextLockoutAt === null)
    return `${progress} · Round in progress`;
  return `${progress} · Next game ${formatGameStart(status.nextLockoutAt, timeZone)} (${formatCountdown(status.nextLockoutAt - at)})`;
}
