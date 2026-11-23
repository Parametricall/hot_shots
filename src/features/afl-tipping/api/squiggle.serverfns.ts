import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  fetchAllCurrentTeams,
  fetchGames,
  fetchIncompleteGames,
  fetchStandings,
  fetchTips,
} from "~/features/afl-tipping/api/squiggle/api";
import { loadSeasons } from "~/features/afl-tipping/api/seasons";
import { FIRST_SEASON } from "~/features/afl-tipping/constants";
import type { Seasons } from "~/features/afl-tipping/utils/afl-season";

const SeasonSchema = z.number().int().min(FIRST_SEASON);

export const getTeamsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return fetchAllCurrentTeams();
});

// Every server function asks which Season is current (to decide whether to enter the Tipster in
// it), and working that out takes several Squiggle calls. Share one answer between them for a
// minute per server instance.
const SEASONS_TTL_MS = 60 * 1000;
let cachedSeasons: { at: number; seasons: Promise<Seasons> } | undefined;

export const getSeasonsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const now = Date.now();
  if (!cachedSeasons || now - cachedSeasons.at > SEASONS_TTL_MS) {
    const seasons = loadSeasons({
      fetchIncompleteGames,
      fetchGames: (season) => fetchGames(season),
      now,
    });
    cachedSeasons = { at: now, seasons };
    // A failure isn't worth keeping for a minute.
    seasons.catch(() => {
      if (cachedSeasons?.seasons === seasons) cachedSeasons = undefined;
    });
  }
  return cachedSeasons.seasons;
});

const GetStandingsSchema = z.object({
  season: SeasonSchema,
});

export const getStandingsServerFn = createServerFn({ method: "GET" })
  .validator(GetStandingsSchema)
  .handler(async ({ data }) => {
    return fetchStandings(data.season);
  });

const GetGamesSchema = z.object({
  season: SeasonSchema,
  round: z.number().optional(),
});

export const getGamesServerFn = createServerFn({ method: "GET" })
  .validator(GetGamesSchema)
  .handler(async ({ data }) => {
    return fetchGames(data.season, data.round);
  });

const GetModelTipsSchema = z.object({
  season: SeasonSchema,
  round: z.number(),
});

export const getModelTipsServerFn = createServerFn({ method: "GET" })
  .validator(GetModelTipsSchema)
  .handler(async ({ data }) => {
    return fetchTips(data.season, data.round);
  });
