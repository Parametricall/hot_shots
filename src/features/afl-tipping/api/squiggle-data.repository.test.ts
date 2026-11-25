import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("~/lib/supabase", () => ({ getSupabaseServerClient: async () => ({}) }));

import { createSquiggleDataRepository } from "~/features/afl-tipping/api/squiggle-data.repository";
import {
  createFakeSupabase,
  filterArgs,
  type FakeCall,
  type FakeReply,
} from "~/features/afl-tipping/mocks/fake-supabase";
import {
  createAflGame,
  createAflStanding,
  createAflTeam,
} from "~/features/afl-tipping/mocks/factories";
import { VENUES } from "~/features/afl-tipping/constants";
import {
  toGameRow,
  toLadderRow,
  toModelTipRow,
  toTeamRow,
} from "~/features/afl-tipping/sync/squiggle-rows";
import type { AflModelTip } from "~/features/afl-tipping/types";

const NOW = Date.parse("2026-11-25T03:00:00Z");
const START = Date.parse("2026-03-14T08:30:00Z");

type Rows = Partial<Record<string, unknown[]>>;

function repoWith(rows: Rows = {}, errors: Record<string, string> = {}) {
  const fake = createFakeSupabase((call: FakeCall): FakeReply => {
    const error = errors[call.table];
    if (error) return { error: { message: error } };
    return { data: rows[call.table] ?? [] };
  });
  return { repo: createSquiggleDataRepository(async () => fake.supabase), calls: fake.calls };
}

/** What a select of the sync's own row returns: the written row, less its `synced_at`. */
function selectable<T extends { synced_at: string }>(row: T): Omit<T, "synced_at"> {
  const { synced_at: _syncedAt, ...rest } = row;
  return rest;
}

const modelTip: AflModelTip = {
  gameId: 7,
  round: 1,
  homeTeamId: 1,
  awayTeamId: 2,
  tipTeamId: 2,
  confidence: 61.25,
  homeConfidence: 38.75,
  awayConfidence: 61.25,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getGames", () => {
  it("maps rows back to the Games the sync wrote, venue and update time included", async () => {
    const game = createAflGame({
      id: 7,
      round: 1,
      unixTime: START,
      date: new Date(START),
      venue: VENUES.mcg,
      timeStr: "Full Time",
      homeScore: 90,
      awayScore: 80,
      winnerTeamId: 1,
      complete: 100,
      updatedAt: START + 3 * 60 * 60_000,
    });
    const { repo } = repoWith({ afl_games: [selectable(toGameRow(game, NOW))] });

    expect(await repo.getGames(2026)).toEqual({ ok: true, games: [game] });
  });

  it("leaves out a venue city and state the row doesn't have, and an unknown update time", async () => {
    const game = createAflGame({ id: 8, venue: { name: "Somewhere Oval" } });
    const { repo } = repoWith({ afl_games: [selectable(toGameRow(game, NOW))] });

    const result = await repo.getGames(2026);

    expect(result.ok && result.games[0]?.venue).toStrictEqual({ name: "Somewhere Oval" });
    expect(result.ok && result.games[0]?.updatedAt).toBeUndefined();
  });

  it("asks for one Season by start time, and one Round when given", async () => {
    const { repo, calls } = repoWith();

    await repo.getGames(2026);
    await repo.getGames(2026, 3);

    expect(calls[0]).toMatchObject({ table: "afl_games" });
    expect(filterArgs(calls[0]!, "eq")).toEqual(["season", 2026]);
    expect(filterArgs(calls[0]!, "order")).toEqual(["start_time"]);
    expect(calls[0]!.filters.filter((f) => f.method === "eq")).toHaveLength(1);
    expect(calls[1]!.filters.filter((f) => f.method === "eq").map((f) => f.args)).toEqual([
      ["season", 2026],
      ["round", 3],
    ]);
  });

  it("returns an empty list and warns once when nothing has been synced", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { repo } = repoWith();

    expect(await repo.getGames(2026)).toEqual({ ok: true, games: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("fails on a Supabase error, and on a row that isn't a Game", async () => {
    const failing = repoWith({}, { afl_games: "boom" });
    expect(await failing.repo.getGames(2026)).toEqual({
      ok: false,
      reason: "supabase-error",
      detail: "boom",
    });

    const bad = repoWith({ afl_games: [{ id: "x" }] });
    expect(await bad.repo.getGames(2026)).toMatchObject({ ok: false, reason: "bad-row" });
  });
});

describe("getIncompleteGames", () => {
  it("asks for the Season's Games with less than 100% complete, soonest first", async () => {
    const { repo, calls } = repoWith();

    expect(await repo.getIncompleteGames(2026)).toEqual({ ok: true, games: [] });

    expect(filterArgs(calls[0]!, "eq")).toEqual(["season", 2026]);
    expect(filterArgs(calls[0]!, "lt")).toEqual(["complete", 100]);
    expect(filterArgs(calls[0]!, "order")).toEqual(["start_time"]);
  });

  it("doesn't warn when a Season has nothing left to finish", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { repo } = repoWith();

    await repo.getIncompleteGames(2026);

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("getGame", () => {
  it("is the Game with that id", async () => {
    const game = createAflGame({ id: 7, unixTime: START, date: new Date(START) });
    const { repo, calls } = repoWith({ afl_games: [selectable(toGameRow(game, NOW))] });

    expect(await repo.getGame(7)).toEqual({ ok: true, game });
    expect(filterArgs(calls[0]!, "eq")).toEqual(["id", 7]);
  });

  it("is null when we hold no such Game", async () => {
    const { repo } = repoWith();

    expect(await repo.getGame(7)).toEqual({ ok: true, game: null });
  });
});

describe("getModelTips", () => {
  it("takes each tip's teams from its Game", async () => {
    const row = {
      ...selectable(toModelTipRow(2026, 7, modelTip, NOW)),
      afl_games: { home_team_id: 1, away_team_id: 2 },
    };
    const { repo, calls } = repoWith({ afl_model_tips: [row] });

    expect(await repo.getModelTips(2026, 1)).toEqual({ ok: true, tips: [modelTip] });
    expect(calls[0]!.filters.filter((f) => f.method === "eq").map((f) => f.args)).toEqual([
      ["season", 2026],
      ["round", 1],
    ]);
  });

  it("reads numeric confidences that arrive as strings", async () => {
    const row = {
      game_id: 7,
      round: 1,
      tip_team_id: 2,
      confidence: "61.25",
      home_confidence: "38.75",
      away_confidence: null,
      afl_games: null,
    };
    const { repo } = repoWith({ afl_model_tips: [row] });

    expect(await repo.getModelTips(2026, 1)).toEqual({
      ok: true,
      tips: [
        {
          gameId: 7,
          round: 1,
          homeTeamId: null,
          awayTeamId: null,
          tipTeamId: 2,
          confidence: 61.25,
          homeConfidence: 38.75,
          awayConfidence: null,
        },
      ],
    });
  });

  it("returns an empty list and warns once when the Model hasn't been synced", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { repo } = repoWith();

    expect(await repo.getModelTips(2026, 1)).toEqual({ ok: true, tips: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getModelTip", () => {
  it("is the Model's tip for one Game, or null", async () => {
    const row = {
      ...selectable(toModelTipRow(2026, 7, modelTip, NOW)),
      afl_games: { home_team_id: 1, away_team_id: 2 },
    };
    const found = repoWith({ afl_model_tips: [row] });
    expect(await found.repo.getModelTip(7)).toEqual({ ok: true, tip: modelTip });
    expect(filterArgs(found.calls[0]!, "eq")).toEqual(["game_id", 7]);

    expect(await repoWith().repo.getModelTip(7)).toEqual({ ok: true, tip: null });
  });
});

describe("getLadder", () => {
  it("maps rows back to Standings, first place first", async () => {
    const standing = createAflStanding({ id: 3, rank: 1, percentage: 131.1 });
    const { repo, calls } = repoWith({
      afl_ladder: [selectable(toLadderRow(2026, standing, NOW))],
    });

    expect(await repo.getLadder(2026)).toEqual({ ok: true, ladder: [standing] });
    expect(filterArgs(calls[0]!, "eq")).toEqual(["season", 2026]);
    expect(filterArgs(calls[0]!, "order")).toEqual(["rank"]);
  });

  it("returns an empty list and warns once before the first sync", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { repo } = repoWith();

    expect(await repo.getLadder(2026)).toEqual({ ok: true, ladder: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("getTeams", () => {
  it("maps rows back to Teams", async () => {
    const team = createAflTeam({ id: 4, name: "Carlton", abbrev: "CAR", debut: 1897 });
    const { repo } = repoWith({ afl_teams: [selectable(toTeamRow(team, NOW))] });

    expect(await repo.getTeams()).toEqual({ ok: true, teams: [team] });
  });

  it("returns an empty list and warns once before the first sync", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { repo } = repoWith();

    expect(await repo.getTeams()).toEqual({ ok: true, teams: [] });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
