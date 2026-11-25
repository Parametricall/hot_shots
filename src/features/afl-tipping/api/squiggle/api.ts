import {
  squiggleGamesDtoToDomain,
  squiggleModelTipListDtoToDomain,
  squiggleStandingsDtoToDomain,
  squiggleTeamsDtoToDomain,
} from "~/features/afl-tipping/api/squiggle/schemas";
import { SQUIGGLE_API_HOST } from "~/features/afl-tipping/api/squiggle/constants";
import { buildSquiggleUserAgent } from "~/features/afl-tipping/api/squiggle/user-agent";
import type { AflGame, AflModelTip, AflStanding, AflTeam } from "~/features/afl-tipping/types";

/**
 * Why a Squiggle request gave us nothing: `http-<status>`, `network` (fetch threw), `parse` (not
 * JSON, or it failed its Zod schema), `squiggle-error` (a 200 whose body is an error, such as
 * `{"games":[{"error":…,"message":…}]}`), `budget` (spent, nothing sent) or `no-contact-email`
 * (nothing sent).
 */
export type SquiggleFailure = {
  ok: false;
  reason: string;
  detail?: string;
};

type Found<K extends string, T> = { ok: true } & { [key in K]: T };

export type SquiggleClient = {
  fetchGames: (params: {
    year: number;
    round?: number;
    /** `"!100"` asks for the Games that aren't complete. */
    complete?: number | `!${number}`;
  }) => Promise<Found<"games", AflGame[]> | SquiggleFailure>;
  fetchGame: (gameId: number) => Promise<Found<"games", AflGame[]> | SquiggleFailure>;
  /** The Model's (Squiggle source 1) tips for one Round. */
  fetchModelTips: (params: {
    year: number;
    round: number;
  }) => Promise<Found<"tips", AflModelTip[]> | SquiggleFailure>;
  /** The Ladder. Squiggle calls it `standings`, and so does the query. */
  fetchLadder: (year: number) => Promise<Found<"ladder", AflStanding[]> | SquiggleFailure>;
  fetchTeams: () => Promise<Found<"teams", AflTeam[]> | SquiggleFailure>;
  /** Requests sent so far, failed ones included. The sync records it per run. */
  requestCount: () => number;
};

type SquiggleSearchParams = {
  q: "teams" | "games" | "tips" | "standings";
  year?: number;
  round?: number;
  game?: number;
  complete?: number | `!${number}`;
  source?: number;
};

type Parser<T> = {
  safeParse: (dto: unknown) => { success: true; data: T } | { success: false; error: Error };
};

function failure(reason: string, detail?: string): SquiggleFailure {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Squiggle answers a bad query with a 200 and `{ "<key>": [{ "error": …, "message": … }] }`. */
function findSquiggleError(dto: unknown): string | undefined {
  if (typeof dto !== "object" || dto === null) return undefined;
  for (const value of Object.values(dto)) {
    const first: unknown = Array.isArray(value) ? value[0] : undefined;
    if (typeof first === "object" && first !== null && "error" in first) {
      const { error, message } = first as { error: unknown; message?: unknown };
      return typeof message === "string" ? `${String(error)}: ${message}` : String(error);
    }
  }
  return undefined;
}

/** Squiggle's query string uses `;` between parameters. */
function buildUrl(params: SquiggleSearchParams): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(";");
  return `${SQUIGGLE_API_HOST}/?${query}`;
}

/**
 * The only way to call Squiggle's Standard API. Each fetcher returns a result and never throws.
 * A client counts its requests and refuses to send more than `budget` (reason `budget`), so a
 * sync run can't spin out of control. Make one per run.
 */
export function createSquiggleClient({ budget }: { budget: number }): SquiggleClient {
  let requests = 0;

  async function request<K extends string, T>(
    params: SquiggleSearchParams,
    key: K,
    schema: Parser<Record<K, T>>,
  ): Promise<Found<K, T> | SquiggleFailure> {
    const userAgent = buildSquiggleUserAgent(process.env.SQUIGGLE_CONTACT_EMAIL);
    if (userAgent === undefined) return failure("no-contact-email");
    if (requests >= budget) return failure("budget");
    requests += 1;

    const url = buildUrl(params);
    let res: Response;
    try {
      res = await fetch(url, { headers: new Headers({ "User-Agent": userAgent }) });
    } catch (err) {
      console.error("[squiggle] fetch threw", { url, message: errorMessage(err) });
      return failure("network", errorMessage(err));
    }
    if (!res.ok) {
      console.warn("[squiggle] non-ok response", { url, status: res.status });
      return failure(`http-${res.status}`);
    }

    let dto: unknown;
    try {
      dto = await res.json();
    } catch (err) {
      return failure("parse", errorMessage(err));
    }
    const squiggleError = findSquiggleError(dto);
    if (squiggleError !== undefined) {
      console.warn("[squiggle] error body", { url, squiggleError });
      return failure("squiggle-error", squiggleError);
    }
    const parsed = schema.safeParse(dto);
    if (!parsed.success) return failure("parse", parsed.error.message);
    return { ok: true, [key]: parsed.data[key] } as Found<K, T>;
  }

  return {
    fetchGames: ({ year, round, complete }) =>
      request({ q: "games", year, round, complete }, "games", squiggleGamesDtoToDomain),
    fetchGame: (gameId) => request({ q: "games", game: gameId }, "games", squiggleGamesDtoToDomain),
    fetchModelTips: ({ year, round }) =>
      // Source 1 is Squiggle's own tipping model.
      request({ q: "tips", year, round, source: 1 }, "tips", squiggleModelTipListDtoToDomain),
    fetchLadder: async (year) => {
      const result = await request(
        { q: "standings", year },
        "standings",
        squiggleStandingsDtoToDomain,
      );
      return result.ok ? { ok: true, ladder: result.standings } : result;
    },
    fetchTeams: () => request({ q: "teams" }, "teams", squiggleTeamsDtoToDomain),
    requestCount: () => requests,
  };
}

/**
 * For a caller that can't carry a result (a server function): the value, or a thrown Error naming
 * why Squiggle gave us nothing. The sync, which can, reads the result instead.
 */
export function unwrapSquiggle<T extends { ok: true }>(result: T | SquiggleFailure): T {
  if (result.ok) return result;
  throw new Error(
    `Squiggle request failed: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`,
  );
}
