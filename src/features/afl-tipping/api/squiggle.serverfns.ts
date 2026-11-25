import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { loadSeasons } from "~/features/afl-tipping/api/seasons";
import {
  squiggleDataRepository,
  unwrapData,
} from "~/features/afl-tipping/api/squiggle-data.repository";
import { FIRST_SEASON } from "~/features/afl-tipping/constants";

const SeasonSchema = z.number().int().min(FIRST_SEASON);

// Every function here reads our own copy of Squiggle's data (plan 015), which the Squiggle sync
// keeps filled. None of them calls Squiggle, so a visitor can't cause a request to it. A failed
// read throws at this boundary.

export const getTeamsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return unwrapData(await squiggleDataRepository.getTeams()).teams;
});

// A database read is cheap, so working out the Current Season on every call needs no cache: it is
// one small query per candidate year.
export const getSeasonsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return loadSeasons({
    fetchIncompleteGames: async (season) =>
      unwrapData(await squiggleDataRepository.getIncompleteGames(season)).games,
    fetchGames: async (season) => unwrapData(await squiggleDataRepository.getGames(season)).games,
    now: Date.now(),
  });
});

const GetStandingsSchema = z.object({
  season: SeasonSchema,
});

export const getStandingsServerFn = createServerFn({ method: "GET" })
  .validator(GetStandingsSchema)
  .handler(async ({ data }) => {
    return unwrapData(await squiggleDataRepository.getLadder(data.season)).ladder;
  });

const GetGamesSchema = z.object({
  season: SeasonSchema,
  round: z.number().optional(),
});

export const getGamesServerFn = createServerFn({ method: "GET" })
  .validator(GetGamesSchema)
  .handler(async ({ data }) => {
    return unwrapData(await squiggleDataRepository.getGames(data.season, data.round)).games;
  });

const GetModelTipsSchema = z.object({
  season: SeasonSchema,
  round: z.number(),
});

export const getModelTipsServerFn = createServerFn({ method: "GET" })
  .validator(GetModelTipsSchema)
  .handler(async ({ data }) => {
    return unwrapData(await squiggleDataRepository.getModelTips(data.season, data.round)).tips;
  });
