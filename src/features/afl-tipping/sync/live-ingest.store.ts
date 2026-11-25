import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";
import {
  LIVE_POST_START_WINDOW_MS,
  LIVE_PRE_GAME_WINDOW_MS,
} from "~/features/afl-tipping/constants";

/** The five live fields of an `afl_games` row, plus when the ingest wrote them. */
export type LiveGamePatch = {
  home_score?: number | null;
  away_score?: number | null;
  time_str?: string;
  complete?: number;
  winner_team_id?: number | null;
  live_updated_at: string;
};

/** What the live ingest needs of a Game to give a finished one its winner. */
export type LiveGameState = {
  id: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
};

/** One live run, as `squiggle_sync_runs` records it. Times are epoch milliseconds. */
export type LiveRun = {
  startedAt: number;
  finishedAt: number;
  ok: boolean;
  reason?: string;
  detail?: string;
  /** Connections opened to Squiggle, failed ones included. */
  requests: number;
};

type Failure = { ok: false; reason: string; detail?: string };
export type LiveStoreResult<T> = ({ ok: true } & T) | Failure;

/**
 * Everything the live ingest asks of the database (plan 015, Step 9), so tests can stand in for it
 * and the ingest never builds a query. Written for the secret-key client.
 */
export type LiveIngestStore = {
  /** Takes the lease for `seconds` unless someone else holds it. */
  acquireLease: (
    holder: string,
    seconds: number,
  ) => Promise<LiveStoreResult<{ acquired: boolean }>>;
  releaseLease: (holder: string) => Promise<LiveStoreResult<unknown>>;
  /** Is a Game unfinished and started between 6 h ago and 30 min from `now`? */
  hasLiveOrImminentGame: (now: number) => Promise<LiveStoreResult<{ active: boolean }>>;
  /** `null` for a Game we don't hold. */
  getGame: (id: number) => Promise<LiveStoreResult<{ game: LiveGameState | null }>>;
  updateGame: (id: number, patch: LiveGamePatch) => Promise<LiveStoreResult<unknown>>;
  insertRun: (run: LiveRun) => Promise<LiveStoreResult<unknown>>;
};

const GameStateRowSchema = z.object({
  id: z.number(),
  home_team_id: z.number().nullable(),
  away_team_id: z.number().nullable(),
  home_score: z.number().nullable(),
  away_score: z.number().nullable(),
});

const fail = (error: { message: string }): Failure => ({
  ok: false,
  reason: "supabase-error",
  detail: error.message,
});

export function createLiveIngestStore(supabase: SupabaseClient): LiveIngestStore {
  return {
    async acquireLease(holder, seconds) {
      const { data, error } = await supabase.rpc("acquire_squiggle_live_lease", {
        holder,
        seconds,
      });
      return error ? fail(error) : { ok: true, acquired: data === true };
    },

    async releaseLease(holder) {
      const { error } = await supabase.rpc("release_squiggle_live_lease", { holder });
      return error ? fail(error) : { ok: true };
    },

    async hasLiveOrImminentGame(now) {
      const { data, error } = await supabase
        .from("afl_games")
        .select("id")
        .lt("complete", 100)
        .gte("start_time", new Date(now - LIVE_POST_START_WINDOW_MS).toISOString())
        .lte("start_time", new Date(now + LIVE_PRE_GAME_WINDOW_MS).toISOString())
        .limit(1);
      if (error) return fail(error);
      return { ok: true, active: Array.isArray(data) && data.length > 0 };
    },

    async getGame(id) {
      const { data, error } = await supabase
        .from("afl_games")
        .select("id, home_team_id, away_team_id, home_score, away_score")
        .eq("id", id)
        .limit(1);
      if (error) return fail(error);
      const parsed = z.array(GameStateRowSchema).safeParse(data);
      if (!parsed.success) return { ok: false, reason: "bad-row", detail: parsed.error.message };
      const row = parsed.data[0];
      return {
        ok: true,
        game:
          row === undefined
            ? null
            : {
                id: row.id,
                homeTeamId: row.home_team_id,
                awayTeamId: row.away_team_id,
                homeScore: row.home_score,
                awayScore: row.away_score,
              },
      };
    },

    async updateGame(id, patch) {
      const { error } = await supabase.from("afl_games").update(patch).eq("id", id);
      return error ? fail(error) : { ok: true };
    },

    async insertRun(run) {
      const { error } = await supabase.from("squiggle_sync_runs").insert({
        job: "live",
        started_at: new Date(run.startedAt).toISOString(),
        finished_at: new Date(run.finishedAt).toISOString(),
        ok: run.ok,
        reason: run.reason ?? null,
        detail: run.detail ?? null,
        requests: run.requests,
      });
      return error ? fail(error) : { ok: true };
    },
  };
}
