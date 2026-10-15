import { describe, it, expect } from "vite-plus/test";
import {
  squiggleGamesDtoToDomain,
  squiggleTeamsDtoToDomain,
  squiggleStandingsDtoToDomain,
  squiggleModelTipListDtoToDomain,
} from "~/features/afl-tipping/api/squiggle/schemas";
import { VENUES } from "~/features/afl-tipping/constants";

// Realistic Squiggle API payloads (shape as returned by api.squiggle.com.au).
// These pin the DTO -> domain transforms so dependency updates (zod in
// particular) can't silently change parsing or mapping behavior.

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

describe("squiggleGamesDtoToDomain", () => {
  it("maps a completed game to the AflGame domain shape", () => {
    const { games } = squiggleGamesDtoToDomain.parse({ games: [gameDto] });

    expect(games).toHaveLength(1);
    expect(games[0]).toEqual({
      id: 8706,
      round: 5,
      roundName: "Round 5",
      venue: VENUES.mcg,
      unixTime: 1776500400 * 1000,
      date: new Date(1776500400 * 1000),
      timeStr: "Full Time",
      homeTeamId: 7,
      homeScore: 95,
      awayTeamId: 10,
      awayScore: 71,
      winnerTeamId: 7,
      complete: 100,
      isFinals: false,
      isGrandFinal: false,
    });
  });

  it("converts unixtime seconds to a millisecond timestamp and Date instance", () => {
    const { games } = squiggleGamesDtoToDomain.parse({ games: [gameDto] });
    const game = games[0]!;

    expect(game.unixTime).toBe(gameDto.unixtime * 1000);
    expect(game.date).toBeInstanceOf(Date);
    expect(game.date.getTime()).toBe(game.unixTime);
  });

  it("defaults a null timestr to 'Not Started'", () => {
    const { games } = squiggleGamesDtoToDomain.parse({
      games: [{ ...gameDto, timestr: null, complete: 0, winner: null, winnerteamid: null }],
    });

    expect(games[0]!.timeStr).toBe("Not Started");
    expect(games[0]!.winnerTeamId).toBeNull();
  });

  it("falls back to a name-only venue for unmapped venues", () => {
    const { games } = squiggleGamesDtoToDomain.parse({
      games: [{ ...gameDto, venue: "Some New Stadium" }],
    });

    expect(games[0]!.venue).toEqual({ name: "Some New Stadium" });
  });

  it("maps finals flags from squiggle's numeric fields", () => {
    const { games } = squiggleGamesDtoToDomain.parse({
      games: [{ ...gameDto, is_final: 1, is_grand_final: 1 }],
    });

    expect(games[0]!.isFinals).toBe(true);
    expect(games[0]!.isGrandFinal).toBe(true);
  });

  it("rejects a payload missing required fields", () => {
    const withoutId: Partial<typeof gameDto> = { ...gameDto };
    delete withoutId.id;
    const result = squiggleGamesDtoToDomain.safeParse({ games: [withoutId] });

    expect(result.success).toBe(false);
  });
});

describe("squiggleTeamsDtoToDomain", () => {
  const teamDto = {
    id: 1,
    name: "Adelaide",
    abbrev: "ADE",
    logo: "/wp-content/themes/squiggle/assets/images/Adelaide.png",
    debut: 1991,
  };

  it("maps a team and rewrites the logo to the self-hosted path", () => {
    const { teams } = squiggleTeamsDtoToDomain.parse({ teams: [teamDto] });

    expect(teams[0]).toEqual({
      id: 1,
      name: "Adelaide",
      abbrev: "ADE",
      logo: "/logos/squiggle/Adelaide.png",
      debut: 1991,
    });
  });

  it("falls back to the dummy logo when the path has no filename", () => {
    const { teams } = squiggleTeamsDtoToDomain.parse({
      teams: [{ ...teamDto, logo: "/images/" }],
    });

    expect(teams[0]!.logo).toBe("/dummy-footy-logo.png");
  });

  it("rejects non-positive team ids", () => {
    const result = squiggleTeamsDtoToDomain.safeParse({ teams: [{ ...teamDto, id: 0 }] });

    expect(result.success).toBe(false);
  });
});

describe("squiggleStandingsDtoToDomain", () => {
  const standingDto = {
    id: 7,
    name: "Geelong",
    rank: 1,
    played: 10,
    wins: 9,
    draws: 0,
    losses: 1,
    pts: 36,
    goals_for: 140,
    goals_against: 100,
    behinds_for: 120,
    behinds_against: 90,
    for: 960,
    against: 690,
    percentage: 139.1,
  };

  it("maps squiggle's snake_case standing fields onto the domain names", () => {
    const { standings } = squiggleStandingsDtoToDomain.parse({ standings: [standingDto] });

    expect(standings[0]).toEqual({
      id: 7,
      name: "Geelong",
      rank: 1,
      played: 10,
      wins: 9,
      losses: 1,
      draws: 0,
      points: 36,
      goalsFor: 140,
      goalsAgainst: 100,
      behindsFor: 120,
      behindsAgainst: 90,
      pointsFor: 960,
      pointsAgainst: 690,
      percentage: 139.1,
    });
  });

  it("rejects fractional values for integer fields", () => {
    const result = squiggleStandingsDtoToDomain.safeParse({
      standings: [{ ...standingDto, wins: 9.5 }],
    });

    expect(result.success).toBe(false);
  });
});

describe("squiggleModelTipListDtoToDomain", () => {
  const tipDto = {
    ateam: "Melbourne",
    ateamid: 10,
    bits: "0.5",
    confidence: "61.5",
    correct: 1,
    date: "2026-04-18 15:20:00",
    err: null,
    gameid: 8706,
    hconfidence: "61.5",
    hmargin: "12.0",
    hteam: "Geelong",
    hteamid: 7,
    margin: "12.0",
    round: 5,
    source: "Squiggle",
    sourceid: 1,
    tip: "Geelong",
    tipteamid: 7,
    updated: "2026-04-18 18:05:00",
    venue: "M.C.G.",
    year: 2026,
  };

  it("parses confidence strings into numbers and derives away confidence", () => {
    const { tips } = squiggleModelTipListDtoToDomain.parse({ tips: [tipDto] });

    expect(tips[0]).toEqual({
      awayTeamId: 10,
      homeTeamId: 7,
      confidence: 61.5,
      gameId: 8706,
      homeConfidence: 61.5,
      awayConfidence: 100 - 61.5,
      round: 5,
      tipTeamId: 7,
    });
  });

  it("maps null confidence values through as null", () => {
    const { tips } = squiggleModelTipListDtoToDomain.parse({
      tips: [{ ...tipDto, confidence: null, hconfidence: null }],
    });

    expect(tips[0]!.confidence).toBeNull();
    expect(tips[0]!.homeConfidence).toBeNull();
    expect(tips[0]!.awayConfidence).toBeNull();
  });
});
