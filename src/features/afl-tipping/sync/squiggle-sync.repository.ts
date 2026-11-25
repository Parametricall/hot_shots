import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";
import type {
  SquiggleJobState,
  SquiggleSyncGame,
  SquiggleSyncJob,
  SquiggleSyncSeason,
  SquiggleSyncState,
} from "~/features/afl-tipping/sync/plan-squiggle-sync";
import type { AflGame, AflModelTip, AflStanding, AflTeam } from "~/features/afl-tipping/types";

/**
 * Our own copy of Squiggle's data (plan 015): what the sync reads to decide what to ask for, and
 * where it writes what Squiggle answers. It takes the Supabase client as a parameter instead of
 * calling `getSupabaseServerClient`, which is a TanStack server-only function and can't be called
 * from a plain Node script (`npm run sync:squiggle`). The endpoint passes the server client in.
 *
 * Domain types and snake_case rows meet here and nowhere else. Writes are bulk upserts, one
 * request per table. A write that fails returns `{ ok: false, reason: "supabase-error" }` and
 * leaves what is already stored alone.
 */

export type SyncWriteResult = { ok: true } | { ok: false; reason: string; detail?: string };

export type LoadSyncStateResult =
  | { ok: true; state: SquiggleSyncState }
  | { ok: false; reason: string; detail?: string };

/** One finished job run, as `squiggle_sync_runs` records it. Times are epoch milliseconds. */
export type SquiggleSyncRun = {
  job: SquiggleSyncJob;
  startedAt: number;
  finishedAt: number;
  ok: boolean;
  reason?: string;
  detail?: string;
  /** Requests sent to Squiggle, failed ones included. */
  requests: number;
};

export type SquiggleSyncRepository = {
  /** What our tables know, for `planSquiggleSync`. */
  loadState: (now: number) => Promise<LoadSyncStateResult>;
  upsertTeams: (teams: AflTeam[], now: number) => Promise<SyncWriteResult>;
  upsertGames: (games: AflGame[], now: number) => Promise<SyncWriteResult>;
  /** The Model's tips for one Season. Tips for a Game we don't hold are left out. */
  upsertModelTips: (season: number, tips: AflModelTip[], now: number) => Promise<SyncWriteResult>;
  upsertLadder: (season: number, ladder: AflStanding[], now: number) => Promise<SyncWriteResult>;
  /** Records that a year's whole Fixture was asked for, and whether Squiggle had Games for it. */
  upsertFixtureCheck: (season: number, hadGames: boolean, now: number) => Promise<SyncWriteResult>;
  insertRun: (run: SquiggleSyncRun) => Promise<SyncWriteResult>;
};

/**
 * A Game the live ingest wrote this recently keeps its live fields when the Fixture sync writes
 * it. The Standard API is up to 60 s behind the Event API (plan 015, Notes), so its copy of a
 * live Game is older than ours and would wind the score back.
 */
export const LIVE_DATA_PROTECTION_MS = 10 * 60_000;

/** The job runs the planner reads. `live` runs belong to the live ingest, not to the plan. */
const PLANNED_JOBS = ["fixture", "model-tips", "ladder", "teams"] as const;
/** Recent runs to read. A job in backoff runs at most hourly, so this reaches back for days. */
const RECENT_RUNS_LIMIT = 200;
/** PostgREST's default cap on rows a request returns. */
const PAGE_SIZE = 1000;

const MELBOURNE_TIME_ZONE = "Australia/Melbourne";

const GameRowSchema = z.object({
  id: z.number(),
  season: z.number(),
  round: z.number(),
  start_time: z.string(),
  complete: z.number(),
  home_team_id: z.number().nullable(),
  away_team_id: z.number().nullable(),
  synced_at: z.string(),
  squiggle_updated: z.string().nullable(),
  live_updated_at: z.string().nullable(),
});
const RunRowSchema = z.object({
  job: z.string(),
  started_at: z.string(),
  ok: z.boolean().nullable(),
});
const RequestsRowSchema = z.object({ requests: z.number() });
const IdRowSchema = z.object({ id: z.number() });
const FixtureCheckRowSchema = z.object({ season: z.number(), checked_at: z.string() });

function supabaseError(error: { message: string }): { ok: false; reason: string; detail: string } {
  return { ok: false, reason: "supabase-error", detail: error.message };
}

function badRow(error: z.ZodError): { ok: false; reason: string; detail: string } {
  return { ok: false, reason: "bad-row", detail: error.message };
}

type Reply = { data: unknown; error: { message: string } | null };

/** A query's rows, checked against their schema. */
function rowsOf<T extends z.ZodType>(
  schema: T,
  { data, error }: Reply,
): { ok: true; rows: z.infer<T>[] } | { ok: false; reason: string; detail: string } {
  if (error) return supabaseError(error);
  const parsed = z.array(schema).safeParse(data);
  return parsed.success ? { ok: true, rows: parsed.data } : badRow(parsed.error);
}

const toIso = (at: number) => new Date(at).toISOString();

/** How far Melbourne's clock is ahead of UTC at `at`, in milliseconds. */
function melbourneOffsetMs(at: number): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: MELBOURNE_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asIfUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return asIfUtc - Math.floor(at / 1000) * 1000;
}

/** The start of the Melbourne day that `at` falls in, as epoch milliseconds. */
export function melbourneMidnight(at: number): number {
  const offset = melbourneOffsetMs(at);
  const local = new Date(at + offset);
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  // Daylight saving changes at 2am or 3am, so the offset at midnight is the day's first.
  return localMidnight - melbourneOffsetMs(localMidnight - offset);
}

function gameRow(game: AflGame, now: number) {
  return {
    id: game.id,
    season: game.season,
    round: game.round,
    round_name: game.roundName,
    venue_name: game.venue.name,
    venue_city: game.venue.city ?? null,
    venue_state: game.venue.state ?? null,
    start_time: toIso(game.unixTime),
    home_team_id: game.homeTeamId,
    away_team_id: game.awayTeamId,
    home_score: game.homeScore,
    away_score: game.awayScore,
    winner_team_id: game.winnerTeamId,
    complete: game.complete,
    time_str: game.timeStr,
    is_finals: game.isFinals,
    is_grand_final: game.isGrandFinal,
    squiggle_updated: game.updatedAt === undefined ? null : toIso(game.updatedAt),
    synced_at: toIso(now),
  };
}

/** The Game row without the fields the live ingest owns while a Game is live. */
function withoutLiveFields(row: ReturnType<typeof gameRow>) {
  const {
    home_score: _homeScore,
    away_score: _awayScore,
    time_str: _timeStr,
    complete: _complete,
    winner_team_id: _winnerTeamId,
    ...rest
  } = row;
  return rest;
}

function toSeasons(rows: z.infer<typeof GameRowSchema>[]): SquiggleSyncSeason[] {
  const bySeason = new Map<number, SquiggleSyncSeason>();
  for (const row of rows) {
    const syncedAt = Date.parse(row.synced_at);
    const game: SquiggleSyncGame = {
      id: row.id,
      round: row.round,
      startTime: Date.parse(row.start_time),
      complete: row.complete,
      homeTeamId: row.home_team_id,
      awayTeamId: row.away_team_id,
    };
    const season = bySeason.get(row.season);
    if (season === undefined) {
      bySeason.set(row.season, {
        season: row.season,
        games: [game],
        lastSyncedAt: syncedAt,
        fullySyncedAt: syncedAt,
      });
    } else {
      season.games.push(game);
      season.lastSyncedAt = Math.max(season.lastSyncedAt, syncedAt);
      season.fullySyncedAt = Math.min(season.fullySyncedAt, syncedAt);
    }
  }
  return [...bySeason.values()].toSorted((a, b) => a.season - b.season);
}

/**
 * When the newest complete Game finished, and its Season. The tables hold no completion time, so
 * it is the later of Squiggle's `updated` and the live ingest's last write, or `synced_at` if
 * Squiggle gave none. Never later than `now`: if Squiggle's time zone is read wrong, that costs a
 * Ladder fetch at the wrong moment, not a wait of hours.
 */
function toLastGameCompletion(
  rows: z.infer<typeof GameRowSchema>[],
  now: number,
): SquiggleSyncState["lastGameCompletion"] {
  let latest: { at: number; season: number } | null = null;
  for (const row of rows) {
    if (row.complete < 100) continue;
    const times = [row.squiggle_updated, row.live_updated_at]
      .filter((time) => time !== null)
      .map((time) => Date.parse(time));
    const at = Math.min(now, times.length > 0 ? Math.max(...times) : Date.parse(row.synced_at));
    if (latest === null || at > latest.at) latest = { at, season: row.season };
  }
  return latest;
}

/** Newest-first run rows, to each planned job's last run, last success and failures since. */
function toJobStates(
  rows: z.infer<typeof RunRowSchema>[],
): Record<SquiggleSyncJob, SquiggleJobState> {
  const jobs = {} as Record<SquiggleSyncJob, SquiggleJobState>;
  for (const job of PLANNED_JOBS) {
    const runs = rows.filter((row) => row.job === job);
    const lastOk = runs.find((run) => run.ok === true);
    const failuresSince = runs.findIndex((run) => run.ok === true);
    jobs[job] = {
      lastRunAt: runs[0] === undefined ? null : Date.parse(runs[0].started_at),
      lastOkAt: lastOk === undefined ? null : Date.parse(lastOk.started_at),
      consecutiveFailures: failuresSince === -1 ? runs.length : failuresSince,
    };
  }
  return jobs;
}

export function createSquiggleSyncRepository(supabase: SupabaseClient): SquiggleSyncRepository {
  async function write(
    table: string,
    rows: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict: string; defaultToNull?: boolean },
  ): Promise<SyncWriteResult> {
    if (Array.isArray(rows) && rows.length === 0) return { ok: true };
    const { error } =
      options === undefined
        ? await supabase.from(table).insert(rows)
        : await supabase.from(table).upsert(rows, options);
    return error ? supabaseError(error) : { ok: true };
  }

  /** Every Game, a page at a time: PostgREST returns at most 1000 rows to a request. */
  async function readGames() {
    const rows: z.infer<typeof GameRowSchema>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("afl_games")
        .select(
          "id, season, round, start_time, complete, home_team_id, away_team_id, synced_at, squiggle_updated, live_updated_at",
        )
        .order("id")
        .range(from, from + PAGE_SIZE - 1);
      const page = rowsOf(GameRowSchema, { data, error });
      if (!page.ok) return page;
      rows.push(...page.rows);
      if (page.rows.length < PAGE_SIZE) return { ok: true as const, rows };
    }
  }

  return {
    async loadState(now) {
      const [games, teams, recentRuns, todayRuns, checks] = await Promise.all([
        readGames(),
        supabase.from("afl_teams").select("id"),
        supabase
          .from("squiggle_sync_runs")
          .select("job, started_at, ok")
          .in("job", [...PLANNED_JOBS])
          .order("started_at", { ascending: false })
          .limit(RECENT_RUNS_LIMIT),
        supabase
          .from("squiggle_sync_runs")
          .select("requests")
          .neq("job", "live")
          .gte("started_at", toIso(melbourneMidnight(now))),
        supabase
          .from("squiggle_fixture_checks")
          .select("season, checked_at")
          .eq("had_games", false),
      ]);

      if (!games.ok) return games;
      const teamRows = rowsOf(IdRowSchema, teams);
      if (!teamRows.ok) return teamRows;
      const runRows = rowsOf(RunRowSchema, recentRuns);
      if (!runRows.ok) return runRows;
      const todayRows = rowsOf(RequestsRowSchema, todayRuns);
      if (!todayRows.ok) return todayRows;
      const checkRows = rowsOf(FixtureCheckRowSchema, checks);
      if (!checkRows.ok) return checkRows;

      return {
        ok: true,
        state: {
          seasons: toSeasons(games.rows),
          knownTeamIds: teamRows.rows.map((row) => row.id),
          jobs: toJobStates(runRows.rows),
          lastGameCompletion: toLastGameCompletion(games.rows, now),
          emptyFixtureChecks: Object.fromEntries(
            checkRows.rows.map((row) => [row.season, Date.parse(row.checked_at)]),
          ),
          requestsToday: todayRows.rows.reduce((sum, row) => sum + row.requests, 0),
        },
      };
    },

    upsertTeams(teams, now) {
      return write(
        "afl_teams",
        teams.map((team) => ({
          id: team.id,
          name: team.name,
          abbrev: team.abbrev,
          logo: team.logo,
          debut: team.debut,
          synced_at: toIso(now),
        })),
        { onConflict: "id" },
      );
    },

    async upsertGames(games, now) {
      if (games.length === 0) return { ok: true };

      // Games the live ingest wrote lately keep their live fields (see LIVE_DATA_PROTECTION_MS).
      const { data, error } = await supabase
        .from("afl_games")
        .select("id")
        .in(
          "id",
          games.map((game) => game.id),
        )
        .gte("live_updated_at", toIso(now - LIVE_DATA_PROTECTION_MS));
      const liveRows = rowsOf(IdRowSchema, { data, error });
      if (!liveRows.ok) return liveRows;
      const liveIds = new Set(liveRows.rows.map((row) => row.id));

      const rows = games.map((game) => ({ game, row: gameRow(game, now) }));
      const idle = rows.filter(({ game }) => !liveIds.has(game.id)).map(({ row }) => row);
      const live = rows.filter(({ game }) => liveIds.has(game.id)).map(({ row }) => row);

      const idleResult = await write("afl_games", idle, { onConflict: "id" });
      if (!idleResult.ok) return idleResult;
      // `defaultToNull: false`: a column left out of the rows keeps its stored value.
      return write("afl_games", live.map(withoutLiveFields), {
        onConflict: "id",
        defaultToNull: false,
      });
    },

    async upsertModelTips(season, tips, now) {
      const byGame = new Map<number, AflModelTip>();
      for (const tip of tips) {
        if (tip.gameId !== null) byGame.set(tip.gameId, tip);
      }
      if (byGame.size === 0) return { ok: true };

      // A tip's Game must be in afl_games (foreign key): one we don't hold yet waits for the sync.
      const { data, error } = await supabase
        .from("afl_games")
        .select("id")
        .in("id", [...byGame.keys()]);
      const known = rowsOf(IdRowSchema, { data, error });
      if (!known.ok) return known;
      const knownIds = new Set(known.rows.map((row) => row.id));

      return write(
        "afl_model_tips",
        [...byGame]
          .filter(([gameId]) => knownIds.has(gameId))
          .map(([gameId, tip]) => ({
            game_id: gameId,
            season,
            round: tip.round,
            tip_team_id: tip.tipTeamId,
            confidence: tip.confidence,
            home_confidence: tip.homeConfidence,
            away_confidence: tip.awayConfidence,
            synced_at: toIso(now),
          })),
        { onConflict: "game_id" },
      );
    },

    upsertLadder(season, ladder, now) {
      return write(
        "afl_ladder",
        ladder.map((standing) => ({
          season,
          team_id: standing.id,
          name: standing.name,
          rank: standing.rank,
          played: standing.played,
          wins: standing.wins,
          losses: standing.losses,
          draws: standing.draws,
          points: standing.points,
          goals_for: standing.goalsFor,
          goals_against: standing.goalsAgainst,
          behinds_for: standing.behindsFor,
          behinds_against: standing.behindsAgainst,
          points_for: standing.pointsFor,
          points_against: standing.pointsAgainst,
          percentage: standing.percentage,
          synced_at: toIso(now),
        })),
        { onConflict: "season,team_id" },
      );
    },

    upsertFixtureCheck(season, hadGames, now) {
      return write(
        "squiggle_fixture_checks",
        { season, checked_at: toIso(now), had_games: hadGames },
        { onConflict: "season" },
      );
    },

    insertRun(run) {
      return write("squiggle_sync_runs", {
        job: run.job,
        started_at: toIso(run.startedAt),
        finished_at: toIso(run.finishedAt),
        ok: run.ok,
        reason: run.reason ?? null,
        detail: run.detail ?? null,
        requests: run.requests,
      });
    },
  };
}
