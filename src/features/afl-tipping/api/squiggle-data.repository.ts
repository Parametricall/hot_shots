import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";
import {
  GAME_COLUMNS,
  GameRowSchema,
  LADDER_COLUMNS,
  LadderRowSchema,
  MODEL_TIP_COLUMNS,
  ModelTipRowSchema,
  TEAM_COLUMNS,
  TeamRowSchema,
  gameFromRow,
  modelTipFromRow,
  standingFromRow,
  teamFromRow,
} from "~/features/afl-tipping/sync/squiggle-rows";
import type { AflGame, AflModelTip, AflStanding, AflTeam } from "~/features/afl-tipping/types";
import { getSupabaseServerClient } from "~/lib/supabase";

/**
 * Squiggle's data, read from our own copy of it (plan 015). The Squiggle sync and the live ingest
 * fill `afl_games`, `afl_model_tips`, `afl_ladder` and `afl_teams`; nothing a visitor does reaches
 * Squiggle. A table the sync hasn't filled yet answers with an empty list and a warning in the
 * log, never with a fallback to Squiggle: the data is the sync's to fetch, and a page that is
 * empty until it has run tells the operator something is wrong rather than hiding it.
 *
 * Rows become domain types in `sync/squiggle-rows.ts`, which the sync repository writes through
 * too. Every query is one request: a Season is about 218 Games, far under PostgREST's 1000-row
 * cap. A read of more than that (every Season at once, say) would have to page, as the sync
 * repository's `readGames` does.
 *
 * Each read returns a result instead of throwing; the server functions throw at their boundary.
 */

export type DataFailure = { ok: false; reason: string; detail?: string };

export type SquiggleDataRepository = {
  /** A Season's Games (one Round's if `round` is given), by start time. */
  getGames: (
    season: number,
    round?: number,
  ) => Promise<{ ok: true; games: AflGame[] } | DataFailure>;
  /** A Season's Games that aren't complete, soonest first. */
  getIncompleteGames: (season: number) => Promise<{ ok: true; games: AflGame[] } | DataFailure>;
  /** One Game by Squiggle's id, or `null` if we hold none. */
  getGame: (gameId: number) => Promise<{ ok: true; game: AflGame | null } | DataFailure>;
  /** The Model's tips for one Round of a Season. */
  getModelTips: (
    season: number,
    round: number,
  ) => Promise<{ ok: true; tips: AflModelTip[] } | DataFailure>;
  /** The Model's tip for one Game, or `null` if it hasn't tipped it. */
  getModelTip: (gameId: number) => Promise<{ ok: true; tip: AflModelTip | null } | DataFailure>;
  /** A Season's Ladder, first place first. */
  getLadder: (season: number) => Promise<{ ok: true; ladder: AflStanding[] } | DataFailure>;
  getTeams: () => Promise<{ ok: true; teams: AflTeam[] } | DataFailure>;
};

type Reply = { data: unknown; error: { message: string } | null };

function rowsOf<T extends z.ZodType>(
  schema: T,
  { data, error }: Reply,
): { ok: true; rows: z.infer<T>[] } | DataFailure {
  if (error) return { ok: false, reason: "supabase-error", detail: error.message };
  const parsed = z.array(schema).safeParse(data);
  return parsed.success
    ? { ok: true, rows: parsed.data }
    : { ok: false, reason: "bad-row", detail: parsed.error.message };
}

/** One warning per call that finds nothing, so an unfilled table shows up in the log. */
function warnIfEmpty(what: string, count: number) {
  if (count === 0) console.warn(`[squiggle-data] no ${what} in our copy: has the sync run?`);
}

export function createSquiggleDataRepository(
  getClient: () => Promise<SupabaseClient>,
): SquiggleDataRepository {
  return {
    async getGames(season, round) {
      const supabase = await getClient();
      let query = supabase.from("afl_games").select(GAME_COLUMNS).eq("season", season);
      if (round !== undefined) query = query.eq("round", round);
      const result = rowsOf(GameRowSchema, await query.order("start_time").order("id"));
      if (!result.ok) return result;
      warnIfEmpty(
        `Games for ${season}${round === undefined ? "" : ` round ${round}`}`,
        result.rows.length,
      );
      return { ok: true, games: result.rows.map(gameFromRow) };
    },

    async getIncompleteGames(season) {
      const supabase = await getClient();
      const result = rowsOf(
        GameRowSchema,
        await supabase
          .from("afl_games")
          .select(GAME_COLUMNS)
          .eq("season", season)
          .lt("complete", 100)
          .order("start_time")
          .order("id"),
      );
      if (!result.ok) return result;
      // Not warned: a Season with nothing left to finish is normal, and `loadSeasons` says what
      // to do when no Season has anything.
      return { ok: true, games: result.rows.map(gameFromRow) };
    },

    async getGame(gameId) {
      const supabase = await getClient();
      const result = rowsOf(
        GameRowSchema,
        await supabase.from("afl_games").select(GAME_COLUMNS).eq("id", gameId).limit(1),
      );
      if (!result.ok) return result;
      const row = result.rows[0];
      return { ok: true, game: row === undefined ? null : gameFromRow(row) };
    },

    async getModelTips(season, round) {
      const supabase = await getClient();
      const result = rowsOf(
        ModelTipRowSchema,
        await supabase
          .from("afl_model_tips")
          .select(MODEL_TIP_COLUMNS)
          .eq("season", season)
          .eq("round", round)
          .order("game_id"),
      );
      if (!result.ok) return result;
      warnIfEmpty(`Model tips for ${season} round ${round}`, result.rows.length);
      return { ok: true, tips: result.rows.map(modelTipFromRow) };
    },

    async getModelTip(gameId) {
      const supabase = await getClient();
      const result = rowsOf(
        ModelTipRowSchema,
        await supabase
          .from("afl_model_tips")
          .select(MODEL_TIP_COLUMNS)
          .eq("game_id", gameId)
          .limit(1),
      );
      if (!result.ok) return result;
      const row = result.rows[0];
      return { ok: true, tip: row === undefined ? null : modelTipFromRow(row) };
    },

    async getLadder(season) {
      const supabase = await getClient();
      const result = rowsOf(
        LadderRowSchema,
        await supabase.from("afl_ladder").select(LADDER_COLUMNS).eq("season", season).order("rank"),
      );
      if (!result.ok) return result;
      warnIfEmpty(`Ladder for ${season}`, result.rows.length);
      return { ok: true, ladder: result.rows.map(standingFromRow) };
    },

    async getTeams() {
      const supabase = await getClient();
      const result = rowsOf(
        TeamRowSchema,
        await supabase.from("afl_teams").select(TEAM_COLUMNS).order("id"),
      );
      if (!result.ok) return result;
      warnIfEmpty("Teams", result.rows.length);
      return { ok: true, teams: result.rows.map(teamFromRow) };
    },
  };
}

export const squiggleDataRepository = createSquiggleDataRepository(getSupabaseServerClient);

/** For a caller that can't carry a result (a server function): the value, or a thrown Error. */
export function unwrapData<T extends { ok: true }>(result: T | DataFailure): T {
  if (result.ok) return result;
  throw new Error(
    `Failed to read Squiggle data: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`,
    { cause: result.detail },
  );
}
