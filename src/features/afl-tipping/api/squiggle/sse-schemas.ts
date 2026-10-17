import * as z from "zod";
import type { AflGame } from "~/features/afl-tipping/types";

/**
 * Squiggle's Event API (SSE) events, parsed into the few Game fields the app
 * keeps live. Squiggle sends the Game id as `gameid` on most events and as `id` on
 * the `game` snapshot sent when a client joins.
 *
 * TODO(sse-pin): only the `score` shape has been seen on the wire (from the `/test`
 * channel on 2026-10-17, outside the Season). The other events follow Squiggle's
 * docs. Parsing is lenient and a wrong guess is not fatal: the `game` snapshots and
 * the resync after a reconnect put right whatever an event missed. Pin the shapes
 * against a live Game and turn them into fixtures in `sse-schemas.test.ts`.
 */

export type LiveGameUpdate = { gameId: number } & Partial<
  Pick<AflGame, "homeScore" | "awayScore" | "timeStr" | "complete" | "winnerTeamId">
>;

const gameSnapshotSchema = z.looseObject({
  id: z.number(),
  hscore: z.number().nullish(),
  ascore: z.number().nullish(),
  timestr: z.string().nullish(),
  complete: z.number().nullish(),
  winnerteamid: z.number().nullish(),
});

const scoreSchema = z.looseObject({
  gameid: z.number(),
  complete: z.number().nullish(),
  timestr: z.string().nullish(),
  score: z.looseObject({ hscore: z.number(), ascore: z.number() }).nullish(),
});

const timestrSchema = z.looseObject({ gameid: z.number(), timestr: z.string() });

const completeSchema = z.looseObject({ gameid: z.number(), complete: z.number() });

const winnerSchema = z.looseObject({ gameid: z.number(), winnerteamid: z.number().nullish() });

/** Drops the fields an event did not carry, so a merge never overwrites with `undefined`. */
function defined(update: LiveGameUpdate): LiveGameUpdate {
  return Object.fromEntries(
    Object.entries(update).filter(([, value]) => value !== undefined),
  ) as LiveGameUpdate;
}

const PARSERS: Record<string, (data: unknown) => LiveGameUpdate | null> = {
  game: (data) => {
    const game = gameSnapshotSchema.parse(data);
    return defined({
      gameId: game.id,
      homeScore: game.hscore ?? undefined,
      awayScore: game.ascore ?? undefined,
      timeStr: game.timestr ?? undefined,
      complete: game.complete ?? undefined,
      winnerTeamId: game.winnerteamid ?? undefined,
    });
  },
  score: (data) => {
    const event = scoreSchema.parse(data);
    return defined({
      gameId: event.gameid,
      homeScore: event.score?.hscore,
      awayScore: event.score?.ascore,
      timeStr: event.timestr ?? undefined,
      complete: event.complete ?? undefined,
    });
  },
  timestr: (data) => {
    const event = timestrSchema.parse(data);
    return { gameId: event.gameid, timeStr: event.timestr };
  },
  complete: (data) => {
    const event = completeSchema.parse(data);
    return { gameId: event.gameid, complete: event.complete };
  },
  winner: (data) => {
    const event = winnerSchema.parse(data);
    return defined({ gameId: event.gameid, winnerTeamId: event.winnerteamid ?? undefined });
  },
};

/** Event names that carry a Game update: the ones the live scores service listens for. */
export const SSE_GAME_EVENT_NAMES = Object.keys(PARSERS);

const warned = new Set<string>();

function warnOnce(eventName: string, detail: unknown) {
  if (warned.has(eventName)) return;
  warned.add(eventName);
  console.warn(`[live-scores] could not parse "${eventName}" event`, detail);
}

/**
 * A Squiggle SSE event as a Game update, or `null` if it is not one or cannot be
 * parsed. A malformed event never throws into the app; it logs once per event name.
 */
export function parseSseEvent(eventName: string, rawData: string): LiveGameUpdate | null {
  const parse = PARSERS[eventName];
  if (!parse) return null;
  try {
    return parse(JSON.parse(rawData));
  } catch (err) {
    warnOnce(eventName, err instanceof Error ? err.message : err);
    return null;
  }
}
