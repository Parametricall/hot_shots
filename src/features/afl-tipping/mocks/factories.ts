import {
  AflGame,
  AflGroupTipEntry,
  AflLeaderboardEntry,
  AflStanding,
  AflTeam,
} from "~/features/afl-tipping/types";
import { VENUES } from "~/features/afl-tipping/constants";

export const fakeTeams: Record<string, Pick<AflTeam, "name" | "abbrev">> = {
  lions: {
    name: "Lions",
    abbrev: "LIO",
  },
  suns: {
    name: "Suns",
    abbrev: "SUN",
  },
  COL: {
    name: "Collingwood",
    abbrev: "COL",
  },
  ESS: {
    name: "Essendon",
    abbrev: "ESS",
  },
};

export function createAflTeam(overrides: Partial<AflTeam> = {}): AflTeam {
  return {
    id: 1,
    ...fakeTeams.lions,
    logo: "/dummy-footy-logo.png",
    debut: 1897,
    ...overrides,
  };
}

export function createAflLeaderboardEntry(
  overrides: Partial<AflLeaderboardEntry> = {},
): AflLeaderboardEntry {
  return {
    userId: "user-1",
    displayName: "John Smith",
    avatarUrl: null,
    correctTips: 10,
    totalMarginDiff: 25,
    score: 10,
    ...overrides,
  };
}

export function createAflGroupTipEntry(
  overrides: Partial<AflGroupTipEntry> = {},
): AflGroupTipEntry {
  return {
    userId: "user-1",
    displayName: "John Smith",
    avatarUrl: null,
    gameId: 0,
    hasTipped: true,
    tipTeamId: null,
    ...overrides,
  };
}

export function createAflStanding(overrides: Partial<AflStanding> = {}): AflStanding {
  return {
    id: 1,
    name: "Lions",
    rank: 1,
    played: 10,
    wins: 7,
    losses: 2,
    draws: 1,
    points: 30,
    goalsFor: 120,
    goalsAgainst: 90,
    behindsFor: 80,
    behindsAgainst: 70,
    pointsFor: 800,
    pointsAgainst: 610,
    percentage: 131.1,
    ...overrides,
  };
}

export function createAflGame(overrides: Partial<AflGame> = {}) {
  const futureTime = Date.now() + 1000 * 60 * 60 * 24; // 24 hours in future
  return {
    id: 0,
    round: 0,
    roundName: "Round 1",
    venue: VENUES.gabba,
    unixTime: futureTime,
    date: new Date(futureTime),
    homeTeamId: 1,
    awayTeamId: 2,
    timeStr: "Q4  4:16",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    complete: 0,
    ...overrides,
  };
}
