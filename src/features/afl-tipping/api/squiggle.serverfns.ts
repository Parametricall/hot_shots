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

const SeasonSchema = z.number().int().min(FIRST_SEASON);

export const getTeamsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return fetchAllCurrentTeams();
});

export const getSeasonsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return loadSeasons({
    fetchIncompleteGames,
    fetchGames: (season) => fetchGames(season),
    now: Date.now(),
  });
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
