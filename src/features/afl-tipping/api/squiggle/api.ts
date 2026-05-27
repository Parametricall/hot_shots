import {
  squiggleGamesDtoToDomain,
  squiggleStandingsDtoToDomain,
  squiggleTeamsDtoToDomain,
  squiggleModelTipListDtoToDomain,
} from "~/features/afl-tipping/api/squiggle/schemas";
import { SQUIGGLE_API_HOST } from "~/features/afl-tipping/api/squiggle/constants";

async function squiggleFetch(searchParams: URLSearchParams) {
  const url = new URL(`${SQUIGGLE_API_HOST}/?${searchParams.toString().replace(/&/g, ";")}`);
  try {
    const res = await fetch(url, {
      headers: new Headers({
        "User-Agent": "Alex's Tipping App - parametricall@users.noreply.github.com",
      }),
    });
    if (!res.ok) {
      console.warn("[squiggleFetch] non-ok response", { url: url.toString(), status: res.status });
    }
    return res;
  } catch (err) {
    console.error("[squiggleFetch] fetch threw", {
      url: url.toString(),
      message: err instanceof Error ? err.message : String(err),
      cause: err instanceof Error ? err.cause : undefined,
    });
    throw err;
  }
}

type SquiggleSearchParams = {
  q: "teams" | "games" | "sources" | "tips" | "standings" | "ladder" | "power";
  year?: number;
  round?: number;
  complete?: number | `!${number}`; // Use `!` prefix for incomplete games
  source?: number; // Source ID for tips
};

function buildSearchParams(params: SquiggleSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  Object.entries(params).forEach(([key, value]) => {
    if (key === "q") {
      searchParams.set("q", value as SquiggleSearchParams["q"]);
    } else if (value !== undefined) {
      searchParams.set(key, value.toString());
    }
  });
  return searchParams;
}

export async function fetchAllCurrentTeams() {
  const response = await squiggleFetch(buildSearchParams({ q: "teams" }));
  if (!response.ok) {
    throw new Error("Failed to fetch teams");
  }
  const dto = await response.json();
  return squiggleTeamsDtoToDomain.parse(dto).teams;
}

export async function fetchStandings() {
  const response = await squiggleFetch(
    buildSearchParams({ q: "standings", year: new Date().getFullYear() }),
  );
  if (!response.ok) {
    throw new Error("Failed to fetch standings");
  }
  const dto = await response.json();
  return squiggleStandingsDtoToDomain.parse(dto).standings;
}

export async function fetchGames(round?: number) {
  const params: SquiggleSearchParams = {
    q: "games",
    year: new Date().getFullYear(),
    round,
  };

  const response = await squiggleFetch(buildSearchParams(params));
  if (!response.ok) {
    throw new Error("Failed to fetch games");
  }

  const dto = await response.json();
  return squiggleGamesDtoToDomain.parse(dto).games;
}

export async function fetchIncompleteGames() {
  const params: SquiggleSearchParams = {
    q: "games",
    complete: "!100",
  };

  const response = await squiggleFetch(buildSearchParams(params));
  if (!response.ok) {
    throw new Error("Failed to fetch incomplete games");
  }
  const dto = await response.json();
  return squiggleGamesDtoToDomain.parse(dto).games.toSorted((a, b) => {
    return a.unixTime - b.unixTime;
  });
}

export async function fetchTips(round: number) {
  const response = await squiggleFetch(
    buildSearchParams({
      q: "tips",
      year: new Date().getFullYear(),
      round,
      source: 1, // Source ID 1 corresponds to Squiggle's tipping model
    }),
  );
  if (!response.ok) {
    throw new Error("Failed to fetch tips");
  }
  const dto = await response.json();
  return squiggleModelTipListDtoToDomain.parse(dto).tips;
}

export async function fetchSquiggleGame(gameId: number) {
  const games = await fetchGames();
  return games.find((g) => g.id === gameId);
}
