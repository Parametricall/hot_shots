import * as z from "zod";
import {
  squiggleGamesDtoToDomain,
  squiggleModelTipListDtoToDomain,
  squiggleStandingsDtoToDomain,
  squiggleTeamsDtoToDomain,
} from "~/features/afl-tipping/api/squiggle/schemas";
import type { AllTipsRow } from "~/features/afl-tipping/api/tips.repository";
import type { AflGame, AflModelTip, AflStanding, AflTeam } from "~/features/afl-tipping/types";

/**
 * The Demo's committed copy of a past Season (docs/adr/0004), written by
 * `scripts/snapshot-demo-season.ts`. The Squiggle parts are Squiggle's raw
 * responses, so the Demo maps them to domain types through the same schemas as
 * production.
 */
export type DemoSnapshot = {
  season: number;
  capturedAt: string; // ISO
  squiggle: {
    teams: unknown;
    games: unknown;
    modelTips: unknown;
    standingsAfterRound: Record<string, unknown>; // round number → `q=standings;round=N` response
  };
  tipsters: { userId: string; displayName: string; joinedAt: number }[];
  tips: AllTipsRow[]; // the made-up Tipsters' Tips, whole Season
};

/** A snapshot after its Squiggle parts have been parsed into domain types. */
export type LoadedSnapshot = {
  season: number;
  capturedAt: string;
  teams: AflTeam[];
  games: AflGame[];
  modelTips: AflModelTip[];
  standingsAfterRound: Map<number, AflStanding[]>;
  tipsters: DemoSnapshot["tipsters"];
  tips: AllTipsRow[];
};

export type LoadSnapshotResult =
  | { ok: true; snapshot: LoadedSnapshot }
  | { ok: false; reason: "parse-failed" | "load-failed"; detail: string };

const tipRowSchema = z.object({
  game_id: z.number(),
  user_id: z.string(),
  tip: z.number(),
  margin: z.number().nullable(),
  is_underdog: z.boolean().nullable(),
  is_auto_tip: z.boolean().optional(),
  created_at: z.string(),
});

const snapshotSchema = z.object({
  season: z.number(),
  capturedAt: z.string(),
  squiggle: z.object({
    teams: z.unknown(),
    games: z.unknown(),
    modelTips: z.unknown(),
    standingsAfterRound: z.record(z.string(), z.unknown()),
  }),
  tipsters: z.array(
    z.object({ userId: z.string(), displayName: z.string(), joinedAt: z.number() }),
  ),
  tips: z.array(tipRowSchema),
});

/** Parses a snapshot value (the JSON file's contents). Never throws. */
export function parseSnapshot(raw: unknown): LoadSnapshotResult {
  try {
    const file = snapshotSchema.parse(raw);
    const standingsAfterRound = new Map<number, AflStanding[]>();
    for (const [round, response] of Object.entries(file.squiggle.standingsAfterRound)) {
      standingsAfterRound.set(
        Number(round),
        squiggleStandingsDtoToDomain.parse(response).standings,
      );
    }
    return {
      ok: true,
      snapshot: {
        season: file.season,
        capturedAt: file.capturedAt,
        teams: squiggleTeamsDtoToDomain.parse(file.squiggle.teams).teams,
        games: squiggleGamesDtoToDomain.parse(file.squiggle.games).games,
        modelTips: squiggleModelTipListDtoToDomain.parse(file.squiggle.modelTips).tips,
        standingsAfterRound,
        tipsters: file.tipsters,
        tips: file.tips,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: "parse-failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

let loading: Promise<LoadSnapshotResult> | undefined;

/**
 * Loads the committed snapshot on demand: the dynamic `import()` keeps it out
 * of every bundle that never calls this, production's included. Memoised.
 */
export function loadSnapshot(): Promise<LoadSnapshotResult> {
  loading ??= import("./season-2026.json").then(
    (module) => parseSnapshot(module.default),
    (err: unknown) => ({
      ok: false as const,
      reason: "load-failed" as const,
      detail: err instanceof Error ? err.message : String(err),
    }),
  );
  return loading;
}
