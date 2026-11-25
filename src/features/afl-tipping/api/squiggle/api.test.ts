import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createSquiggleClient } from "~/features/afl-tipping/api/squiggle/api";

const EMAIL = "test@example.com";

const gameDto = {
  id: 8706,
  round: 5,
  roundname: "Round 5",
  venue: "M.C.G.",
  localtime: "2026-04-18 15:20:00",
  unixtime: 1776500400,
  date: "2026-04-18 15:20:00",
  tz: "+10:00",
  year: 2026,
  is_final: 0,
  is_grand_final: 0,
  timestr: "Full Time",
  updated: "2026-04-18 18:05:00",
  complete: 100,
  winner: "Geelong",
  winnerteamid: 7,
  hteamid: 7,
  hteam: "Geelong",
  hscore: 95,
  hgoals: 14,
  hbehinds: 11,
  ateamid: 10,
  ateam: "Melbourne",
  ascore: 71,
  agoals: 10,
  abehinds: 11,
};

const teamDto = {
  id: 1,
  name: "Adelaide",
  abbrev: "ADE",
  logo: "/wp-content/themes/squiggle/assets/images/Adelaide.png",
  debut: 1991,
};

const standingDto = {
  id: 7,
  name: "Geelong",
  rank: 1,
  played: 23,
  wins: 18,
  draws: 0,
  losses: 5,
  pts: 72,
  goals_for: 300,
  goals_against: 200,
  behinds_for: 250,
  behinds_against: 220,
  for: 2050,
  against: 1420,
  percentage: 144.4,
};

const tipDto = {
  ateam: "Melbourne",
  ateamid: 10,
  bits: null,
  confidence: "62.5",
  correct: null,
  date: "2026-04-18 15:20:00",
  err: null,
  gameid: 8706,
  hconfidence: "62.5",
  hmargin: null,
  hteam: "Geelong",
  hteamid: 7,
  margin: null,
  round: 5,
  source: "Squiggle",
  sourceid: 1,
  tip: "Geelong",
  tipteamid: 7,
  updated: "2026-04-18 10:00:00",
  venue: "M.C.G.",
  year: 2026,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("createSquiggleClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SQUIGGLE_CONTACT_EMAIL", EMAIL);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const requestedUrl = (call = 0) => String(fetchMock.mock.calls[call]![0]);
  const requestedHeaders = (call = 0) =>
    new Headers((fetchMock.mock.calls[call]![1] as RequestInit).headers);

  it("identifies itself with the contact email in the User-Agent", async () => {
    fetchMock.mockResolvedValue(json({ teams: [teamDto] }));
    await createSquiggleClient({ budget: 5 }).fetchTeams();

    expect(requestedHeaders().get("User-Agent")).toBe(
      `Hot Shots Tipping (hot-shots.dev) - ${EMAIL}`,
    );
  });

  it("makes no request without a contact email", async () => {
    vi.stubEnv("SQUIGGLE_CONTACT_EMAIL", "");
    const client = createSquiggleClient({ budget: 5 });
    const result = await client.fetchTeams();

    expect(result).toEqual({ ok: false, reason: "no-contact-email" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.requestCount()).toBe(0);
  });

  it("returns games for a year", async () => {
    fetchMock.mockResolvedValue(json({ games: [gameDto] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchGames({ year: 2026 });

    expect(requestedUrl()).toBe("https://api.squiggle.com.au/?q=games;year=2026");
    expect(result.ok && result.games.map((g) => g.id)).toEqual([8706]);
  });

  it("asks only for incomplete games when told to", async () => {
    fetchMock.mockResolvedValue(json({ games: [] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchGames({
      year: 2027,
      complete: "!100",
    });

    expect(requestedUrl()).toBe("https://api.squiggle.com.au/?q=games;year=2027;complete=!100");
    expect(result).toEqual({ ok: true, games: [] });
  });

  it("fetches one game by id", async () => {
    fetchMock.mockResolvedValue(json({ games: [gameDto] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchGame(8706);

    expect(requestedUrl()).toBe("https://api.squiggle.com.au/?q=games;game=8706");
    expect(result.ok && result.games).toHaveLength(1);
  });

  it("fetches the Model's tips for a round", async () => {
    fetchMock.mockResolvedValue(json({ tips: [tipDto] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchModelTips({
      year: 2026,
      round: 5,
    });

    expect(requestedUrl()).toBe("https://api.squiggle.com.au/?q=tips;year=2026;round=5;source=1");
    expect(result.ok && result.tips[0]?.gameId).toBe(8706);
  });

  it("fetches the Ladder from Squiggle's standings query", async () => {
    fetchMock.mockResolvedValue(json({ standings: [standingDto] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchLadder(2026);

    expect(requestedUrl()).toBe("https://api.squiggle.com.au/?q=standings;year=2026");
    expect(result.ok && result.ladder[0]?.rank).toBe(1);
  });

  it("fetches teams", async () => {
    fetchMock.mockResolvedValue(json({ teams: [teamDto] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchTeams();

    expect(requestedUrl()).toBe("https://api.squiggle.com.au/?q=teams");
    expect(result.ok && result.teams[0]?.name).toBe("Adelaide");
  });

  it("reports an http status as http-<status>", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 503 }));
    const result = await createSquiggleClient({ budget: 5 }).fetchLadder(2026);

    expect(result).toMatchObject({ ok: false, reason: "http-503" });
  });

  it("reports a thrown fetch as network, with the message as detail", async () => {
    fetchMock.mockRejectedValue(new Error("socket hang up"));
    const result = await createSquiggleClient({ budget: 5 }).fetchLadder(2026);

    expect(result).toEqual({ ok: false, reason: "network", detail: "socket hang up" });
  });

  it("reports a body that fails its schema as parse", async () => {
    fetchMock.mockResolvedValue(json({ games: [{ id: "not a number" }] }));
    const result = await createSquiggleClient({ budget: 5 }).fetchGames({ year: 2026 });

    expect(result).toMatchObject({ ok: false, reason: "parse" });
  });

  it("reports a body that is not JSON as parse", async () => {
    fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }));
    const result = await createSquiggleClient({ budget: 5 }).fetchGames({ year: 2026 });

    expect(result).toMatchObject({ ok: false, reason: "parse" });
  });

  it("reports a 200 carrying an error body as squiggle-error", async () => {
    fetchMock.mockResolvedValue(
      json({
        games: [
          {
            error: "missing_parameter",
            message: "The 'games' query requires additional parameters.",
          },
        ],
      }),
    );
    const result = await createSquiggleClient({ budget: 5 }).fetchGames({ year: 2026 });

    expect(result).toEqual({
      ok: false,
      reason: "squiggle-error",
      detail: "missing_parameter: The 'games' query requires additional parameters.",
    });
  });

  it("counts every request, and refuses with budget once it is spent", async () => {
    // A Response body can be read once, so each request gets a fresh one.
    fetchMock.mockImplementation(async () => json({ teams: [teamDto] }));
    const client = createSquiggleClient({ budget: 2 });

    expect((await client.fetchTeams()).ok).toBe(true);
    expect(client.requestCount()).toBe(1);
    expect((await client.fetchTeams()).ok).toBe(true);
    expect(client.requestCount()).toBe(2);

    expect(await client.fetchTeams()).toMatchObject({ ok: false, reason: "budget" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(client.requestCount()).toBe(2);
  });

  it("counts a failed request against the budget", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const client = createSquiggleClient({ budget: 1 });
    await client.fetchTeams();

    expect(client.requestCount()).toBe(1);
    expect(await client.fetchTeams()).toMatchObject({ reason: "budget" });
  });
});
