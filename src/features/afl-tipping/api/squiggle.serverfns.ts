import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import {
  fetchAllCurrentTeams,
  fetchGames,
  fetchIncompleteGames,
  fetchStandings,
  fetchTips,
} from "~/features/afl-tipping/api/squiggle/api";
import { CACHE_DURATIONS } from "~/features/afl-tipping/constants";
import { withCache } from "~/features/afl-tipping/api/cache";

export const getTeamsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return withCache("teams", CACHE_DURATIONS.TEAMS, () => fetchAllCurrentTeams());
});

export const getStandingsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return withCache("standings", CACHE_DURATIONS.STANDINGS, () => fetchStandings());
});

const GetGamesSchema = z.object({
  round: z.number().optional(),
});

export const getGamesServerFn = createServerFn({ method: "GET" })
  .inputValidator(GetGamesSchema)
  .handler(async ({ data }) => {
    return withCache(`games:${data.round ?? "all"}`, CACHE_DURATIONS.GAMES, () =>
      fetchGames(data.round),
    );
  });

export const getIncompleteGamesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  return withCache("incompleteGames", CACHE_DURATIONS.INCOMPLETE_GAMES, () =>
    fetchIncompleteGames(),
  );
});

const GetModelTipsSchema = z.object({
  round: z.number(),
});

export const getModelTipsServerFn = createServerFn({ method: "GET" })
  .inputValidator(GetModelTipsSchema)
  .handler(async ({ data }) => {
    return withCache(`modelTips:${data.round}`, CACHE_DURATIONS.MODEL_TIPS, () =>
      fetchTips(data.round),
    );
  });
