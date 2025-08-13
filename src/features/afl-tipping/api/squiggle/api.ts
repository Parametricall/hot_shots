import {
  squiggleStandingsDtoToDomain,
  squiggleTeamsDtoToDomain,
} from "~/features/afl-tipping/api/squiggle/schemas";
import { SQUIGGLE_API_HOST } from "~/features/afl-tipping/api/squiggle/constants";

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

export async function fetchAllCurrentTeams() {
  const response = await squiggleFetch(buildSearchParams({ q: "teams" }));
  if (!response.ok) {
    throw new Error("Failed to fetch teams");
  }
  const dto = await response.json();
  return squiggleTeamsDtoToDomain.parse(dto);
}

export async function fetchStandings() {
  const response = await squiggleFetch(
    buildSearchParams({ q: "standings", year: new Date().getFullYear() }),
  );
  if (!response.ok) {
    throw new Error("Failed to fetch standings");
  }
  const dto = await response.json();
  return squiggleStandingsDtoToDomain.parse(dto);
}
