import * as z from "zod";

const SQUIGGLE_HOST = "https://squiggle.com.au";
const SQUIGGLE_API_HOST = "https://api.squiggle.com.au";

function squiggleFetch(searchParams: URLSearchParams) {
  const url = new URL(`${SQUIGGLE_API_HOST}/?${searchParams.toString()}`);
  return fetch(url, {
    headers: new Headers({
      "User-Agent":
        "Alex's Tipping App - parametricall@users.noreply.github.com",
    }),
  });
}

type SquiggleSearchParams = {
  q: "teams" | "games" | "sources" | "tips" | "standings" | "ladder" | "power";
  year?: number;
  round?: number;
};

export type AflTeam = {
  abbrev: string;
  logo: string;
  name: string;
  id: number;
  debut: number;
};

type AflStanding = {
  id: number;
  name: string;
  rank: number;
};

const squiggleTeamSchema = z.object({
  abbrev: z.string(),
  logo: z.string().min(1),
  name: z.string(),
  id: z.number().positive(),
  debut: z.number().positive(),
});

const squiggleStandingSchema = z.object({
  for: z.number().int(),
  percentage: z.number(),
  behinds_against: z.number().int(),
  played: z.number().int(),
  name: z.string(),
  rank: z.number().positive(),
  goals_against: z.number().int(),
  losses: z.number().int(),
  id: z.number().positive(),
  draws: z.number().int(),
  pts: z.number().positive(),
  against: z.number().int(),
  wins: z.number().int(),
  goals_for: z.number().int(),
  behinds_for: z.number().int(),
});

const aflTeamFromSquiggleTeam: z.ZodType<AflTeam> =
  squiggleTeamSchema.transform((dto) => ({
    ...dto,
    logo: `${SQUIGGLE_HOST}${dto.logo}`,
  }));

const aflStandingFromSquiggleStanding: z.ZodType<AflStanding> =
  squiggleStandingSchema.transform((dto) => ({
    ...dto,
  }));

function buildSearchParams(params: SquiggleSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  if (params.year) {
    searchParams.set("year", params.year.toString());
  }
  if (params.round) {
    searchParams.set("round", params.round.toString());
  }
  return searchParams;
}

async function fetchAllCurrentTeamsApi() {
  return squiggleFetch(buildSearchParams({ q: "teams" }));
}

async function fetchStandingsApi() {
  return squiggleFetch(
    buildSearchParams({ q: "standings", year: new Date().getFullYear() }),
  );
}

const aflTeamsFromSquiggleTeams = z.object({
  teams: z.array(aflTeamFromSquiggleTeam),
});
export async function fetchAllCurrentTeams() {
  const response = await fetchAllCurrentTeamsApi();
  if (!response.ok) {
    throw new Error("Failed to fetch teams");
  }
  const dto = await response.json();
  return aflTeamsFromSquiggleTeams.parse(dto);
}

const aflStandingsFromSquiggleStandings = z.object({
  standings: z.array(aflStandingFromSquiggleStanding),
});
export async function fetchStandings() {
  const response = await fetchStandingsApi();
  if (!response.ok) {
    throw new Error("Failed to fetch standings");
  }
  const dto = await response.json();
  return aflStandingsFromSquiggleStandings.parse(dto);
}
