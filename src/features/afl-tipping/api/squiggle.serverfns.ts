import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSquiggleClient, unwrapSquiggle } from "~/features/afl-tipping/api/squiggle/api";
import { loadSeasons } from "~/features/afl-tipping/api/seasons";
import { FIRST_SEASON } from "~/features/afl-tipping/constants";
import type { Seasons } from "~/features/afl-tipping/utils/afl-season";

const SeasonSchema = z.number().int().min(FIRST_SEASON);

// These still read Squiggle directly; Step 8 of plan 015 moves them to our own tables. Each call
// gets its own client, so its budget is per call, and a failure throws at this boundary.
const REQUEST_BUDGET = 10;

async function fetchGames(season: number, round?: number) {
  const client = createSquiggleClient({ budget: REQUEST_BUDGET });
  return unwrapSquiggle(await client.fetchGames({ year: season, round })).games;
}

/** A Season's Games that aren't complete, soonest first. Squiggle needs the year for this. */
async function fetchIncompleteGames(season: number) {
  const client = createSquiggleClient({ budget: REQUEST_BUDGET });
  const { games } = unwrapSquiggle(await client.fetchGames({ year: season, complete: "!100" }));
  return games.toSorted((a, b) => a.unixTime - b.unixTime);
}

export const getTeamsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const client = createSquiggleClient({ budget: REQUEST_BUDGET });
  return unwrapSquiggle(await client.fetchTeams()).teams;
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
    const client = createSquiggleClient({ budget: REQUEST_BUDGET });
    return unwrapSquiggle(await client.fetchLadder(data.season)).ladder;
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
    const client = createSquiggleClient({ budget: REQUEST_BUDGET });
    return unwrapSquiggle(await client.fetchModelTips({ year: data.season, round: data.round }))
      .tips;
  });
