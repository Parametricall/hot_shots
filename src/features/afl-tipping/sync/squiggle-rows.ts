import * as z from "zod";
import type { AflGame, AflModelTip, AflStanding, AflTeam } from "~/features/afl-tipping/types";

/**
 * Where domain types and snake_case rows meet for our copy of Squiggle's data (plan 015). The sync
 * repository writes through the `to…Row` functions and the data repository reads through the
 * `…FromRow` ones, so a column is named in exactly one place. Each row schema is what a select of
 * the matching `…_COLUMNS` returns, and a row that doesn't match it is a bad row, not a guess.
 */

const toIso = (at: number) => new Date(at).toISOString();

export const TEAM_COLUMNS = "id, name, abbrev, logo, debut";
export const GAME_COLUMNS =
  "id, season, round, round_name, venue_name, venue_city, venue_state, start_time, home_team_id, away_team_id, home_score, away_score, winner_team_id, complete, time_str, is_finals, is_grand_final, squiggle_updated";
/** A Model tip's own columns, and its Game's teams (the table doesn't repeat them). */
export const MODEL_TIP_COLUMNS =
  "game_id, round, tip_team_id, confidence, home_confidence, away_confidence, afl_games(home_team_id, away_team_id)";
export const LADDER_COLUMNS =
  "team_id, name, rank, played, wins, losses, draws, points, goals_for, goals_against, behinds_for, behinds_against, points_for, points_against, percentage";

/** `numeric` columns: PostgREST sends a number, but a string would still be a number to us. */
const numeric = z.coerce.number();

export const TeamRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  abbrev: z.string(),
  logo: z.string(),
  debut: z.number(),
});

export const GameRowSchema = z.object({
  id: z.number(),
  season: z.number(),
  round: z.number(),
  round_name: z.string(),
  venue_name: z.string(),
  venue_city: z.string().nullable(),
  venue_state: z.string().nullable(),
  start_time: z.string(),
  home_team_id: z.number().nullable(),
  away_team_id: z.number().nullable(),
  home_score: z.number().nullable(),
  away_score: z.number().nullable(),
  winner_team_id: z.number().nullable(),
  complete: z.number(),
  time_str: z.string(),
  is_finals: z.boolean(),
  is_grand_final: z.boolean(),
  squiggle_updated: z.string().nullable(),
});

export const ModelTipRowSchema = z.object({
  game_id: z.number(),
  round: z.number(),
  tip_team_id: z.number().nullable(),
  confidence: numeric.nullable(),
  home_confidence: numeric.nullable(),
  away_confidence: numeric.nullable(),
  // The embedded Game: an object (many-to-one), or null if the join found nothing.
  afl_games: z
    .object({ home_team_id: z.number().nullable(), away_team_id: z.number().nullable() })
    .nullable(),
});

export const LadderRowSchema = z.object({
  team_id: z.number(),
  name: z.string(),
  rank: z.number(),
  played: z.number(),
  wins: z.number(),
  losses: z.number(),
  draws: z.number(),
  points: z.number(),
  goals_for: z.number(),
  goals_against: z.number(),
  behinds_for: z.number(),
  behinds_against: z.number(),
  points_for: z.number(),
  points_against: z.number(),
  percentage: numeric,
});

export function toTeamRow(team: AflTeam, now: number) {
  return {
    id: team.id,
    name: team.name,
    abbrev: team.abbrev,
    logo: team.logo,
    debut: team.debut,
    synced_at: toIso(now),
  };
}

export function toGameRow(game: AflGame, now: number) {
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

export function toModelTipRow(season: number, gameId: number, tip: AflModelTip, now: number) {
  return {
    game_id: gameId,
    season,
    round: tip.round,
    tip_team_id: tip.tipTeamId,
    confidence: tip.confidence,
    home_confidence: tip.homeConfidence,
    away_confidence: tip.awayConfidence,
    synced_at: toIso(now),
  };
}

export function toLadderRow(season: number, standing: AflStanding, now: number) {
  return {
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
  };
}

export function teamFromRow(row: z.infer<typeof TeamRowSchema>): AflTeam {
  return { id: row.id, name: row.name, abbrev: row.abbrev, logo: row.logo, debut: row.debut };
}

export function gameFromRow(row: z.infer<typeof GameRowSchema>): AflGame {
  const unixTime = Date.parse(row.start_time);
  return {
    id: row.id,
    season: row.season,
    round: row.round,
    roundName: row.round_name,
    venue: {
      name: row.venue_name,
      ...(row.venue_city === null ? {} : { city: row.venue_city }),
      ...(row.venue_state === null ? {} : { state: row.venue_state }),
    },
    unixTime,
    date: new Date(unixTime),
    timeStr: row.time_str,
    homeTeamId: row.home_team_id,
    homeScore: row.home_score,
    awayTeamId: row.away_team_id,
    awayScore: row.away_score,
    winnerTeamId: row.winner_team_id,
    complete: row.complete,
    isFinals: row.is_finals,
    isGrandFinal: row.is_grand_final,
    updatedAt: row.squiggle_updated === null ? undefined : Date.parse(row.squiggle_updated),
  };
}

export function modelTipFromRow(row: z.infer<typeof ModelTipRowSchema>): AflModelTip {
  return {
    gameId: row.game_id,
    round: row.round,
    homeTeamId: row.afl_games?.home_team_id ?? null,
    awayTeamId: row.afl_games?.away_team_id ?? null,
    tipTeamId: row.tip_team_id,
    confidence: row.confidence,
    homeConfidence: row.home_confidence,
    awayConfidence: row.away_confidence,
  };
}

export function standingFromRow(row: z.infer<typeof LadderRowSchema>): AflStanding {
  return {
    id: row.team_id,
    name: row.name,
    rank: row.rank,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    points: row.points,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    behindsFor: row.behinds_for,
    behindsAgainst: row.behinds_against,
    pointsFor: row.points_for,
    pointsAgainst: row.points_against,
    percentage: row.percentage,
  };
}
