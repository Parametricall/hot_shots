import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  fetchAllCurrentTeams,
  fetchGames,
  fetchIncompleteGames,
  fetchStandings,
  fetchTips,
} from "~/features/afl-tipping/api/squiggle/api";

export const getTeamsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return fetchAllCurrentTeams();
});

export const getStandingsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return fetchStandings();
});

const GetGamesSchema = z.object({
  round: z.number().optional(),
});

export const getGamesServerFn = createServerFn({ method: "GET" })
  .validator(GetGamesSchema)
  .handler(async ({ data }) => {
    return fetchGames(data.round);
  });

export const getIncompleteGamesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return fetchIncompleteGames();
});

const GetModelTipsSchema = z.object({
  round: z.number(),
});

export const getModelTipsServerFn = createServerFn({ method: "GET" })
  .validator(GetModelTipsSchema)
  .handler(async ({ data }) => {
    return fetchTips(data.round);
  });
